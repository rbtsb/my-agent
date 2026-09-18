"""
A tiny, device-agnostic protocol for agent-initiated interrupts (the agent needs a structured
answer from the human before it can continue).

The idea: the agent never emits HTML or a mobile widget — only a JSON description of what it
needs. Every client (web page, native mobile app, CLI, whatever comes later) renders that same
JSON into whatever UI makes sense on that device, and sends the answer back in one shared shape.
That's the whole contract — new field "type"s can be added later without breaking old clients
(an unrecognized type just falls back to free text). Field types so far:
  - "choice" — single/multi-select from a list, with an optional free-text fallback
  - "date"   — a single calendar date; web renders a native <input type="date">
  - "confirm" — a plain yes/no decision, rendered as two full-width buttons (not chips)

Interrupt payload (agent -> client):
{
  "protocol": "agent-interrupt/1.0",
  "interrupt_id": "...",             # opaque, echoed back unchanged in the response
  "title": "What priority should this task have?",
  "fields": [
    {
      "name": "priority",           # key the answer is returned under
      "type": "choice",             # "choice" today; more types can be added later
      "label": "Priority",
      "multiple": false,            # false = radio buttons / single-select, true = checkboxes
      "options": [{"value": "low", "label": "Low"}, ...],
      "allow_custom": true,         # let the user type something not on the list
      "custom_label": "Other (type your own)"
    }
  ]
}

Response (client -> agent), fed to LangGraph's `interrupt()` as the resume value:
{
  "protocol": "agent-interrupt/1.0",
  "interrupt_id": "...",            # must match the payload that prompted it
  "values": {
    "priority": ["low"]             # a field's answer is always a list of strings —
  }                                  # a single-select still returns a one-item list, a typed
}                                    # custom answer is just a string in that same list.
"""

PROTOCOL_VERSION = "agent-interrupt/1.0"


def choice_interrupt(interrupt_id: str, title: str, field_name: str, field_label: str,
                      options: list[tuple[str, str]], multiple: bool = False, allow_custom: bool = True):
    return {
        "protocol": PROTOCOL_VERSION,
        "interrupt_id": interrupt_id,
        "title": title,
        "fields": [
            {
                "name": field_name,
                "type": "choice",
                "label": field_label,
                "multiple": multiple,
                "options": [{"value": value, "label": label} for value, label in options],
                "allow_custom": allow_custom,
                "custom_label": "Other (type your own)",
            }
        ],
    }


def date_interrupt(interrupt_id: str, title: str, field_name: str, field_label: str):
    return {
        "protocol": PROTOCOL_VERSION,
        "interrupt_id": interrupt_id,
        "title": title,
        "fields": [{"name": field_name, "type": "date", "label": field_label}],
    }


def confirm_interrupt(interrupt_id: str, title: str, field_name: str = "confirm",
                       yes_label: str = "Confirm", no_label: str = "Cancel"):
    return {
        "protocol": PROTOCOL_VERSION,
        "interrupt_id": interrupt_id,
        "title": title,
        "fields": [{
            "name": field_name,
            "type": "confirm",
            "label": "",
            "yes_label": yes_label,
            "no_label": no_label,
        }],
    }


def is_confirmed(response: dict, field_name: str = "confirm") -> bool:
    return field_values(response, field_name) == ["yes"]


def is_cancelled(response: dict) -> bool:
    """True when the user closed/cancelled the sheet instead of answering it — distinct from an
    empty answer, which for a multi-select could legitimately mean 'none of these'."""
    return bool(response.get("cancelled"))


def field_values(response: dict, field_name: str) -> list[str]:
    """Pulls one field's answer out of a response payload, always as a list of strings."""
    values = response.get("values", {}).get(field_name, [])
    return values if isinstance(values, list) else [values]
