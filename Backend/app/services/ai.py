import asyncio
import logging
from typing import Any, List, Optional, Union
from google import genai
from google.genai import types
from app.config import get_settings

logger = logging.getLogger("porikroma.ai")

LAST_N_MESSAGES = 10

SYSTEM_PROMPT = (
    "You are Porikroma AI, an expert, enthusiastic, and culturally attuned travel planner "
    "specializing exclusively in Bangladesh tourism and exploration.\n\n"
    "Guidelines:\n"
    "1. Respond in the user's language: if the user writes in Bangla, respond in natural, polite Bangla; "
    "if in English, respond in clear, evocative English.\n"
    "2. All budgets, costs, and estimates must be presented in Bangladeshi Taka (BDT / ৳).\n"
    "3. Keep trip itineraries highly structured with clear day-by-day headings (e.g. 'Day 1: ...', 'Day 2: ...'), "
    "highlighting transport routes, local stays, cultural/culinary highlights, and practical safety/permit advice.\n"
    "4. Promote sustainable, community-first, and respectful travel practices across Bangladesh."
)


def fallback_rule_based_reply(user_prompt: str) -> str:
    """Deterministic fallback reply generator when Gemini API is unavailable or unconfigured."""
    prompt = (user_prompt or "").lower()

    if "cox" in prompt or "beach" in prompt or "sea" in prompt:
        return (
            "Here is a curated coastal escape plan for Cox’s Bazar:\n\n"
            "• Day 1: Arrive via air or overnight AC sleeper. Check in around Kolatoli or Marine Drive "
            "(e.g. Mermaid Eco Resort or Sayeman). Evening sunset walk by South Beach away from town crowds.\n"
            "• Day 2: Morning cruise along Marine Drive down to Himchari National Park and Inani Coral Beach. "
            "Enjoy fresh green coconuts from local vendors.\n"
            "• Day 3: Morning surfing lesson or sea swim at Laboni point. Fresh seafood barbecue dinner at "
            "Salt & Pepper or Jhaoban (try grilled pomfret and loitta fry).\n\n"
            "Budget recommendation: ৳8,500 – ৳15,000 per person depending on stay choice."
        )

    if "sylhet" in prompt or "tea" in prompt or "sreemangal" in prompt:
        return (
            "For a slow, refreshing journey into Sylhet & Sreemangal:\n\n"
            "• Route: Parabat Express train from Dhaka to Sreemangal (approx 4.5 hrs, scenic countryside view).\n"
            "• Stays: Quiet eco-resorts inside Radhanagar tea estates.\n"
            "• Experiences: Dawn walk in Lawachara Rainforest to hear Hoolock Gibbons, cycle through finlay tea "
            "estates, and a silent wooden boat ride on Lalakhal’s emerald river waters.\n"
            "• Culinary: Seven-layer tea at Nilkantha, followed by Sylheti beef shatkora and fresh river fish curries.\n\n"
            "Recommended duration: 3 to 4 days · Estimated budget: ৳7,500 – ৳12,000."
        )

    if "bandarban" in prompt or "trek" in prompt or "hill" in prompt or "keokradong" in prompt:
        return (
            "Bandarban adventure blueprint:\n\n"
            "• Important: Foreign and domestic travelers must register at Army checkpoints with NID/Passport copies.\n"
            "• Suggested Route: Bandarban town → Ruma Bazar by Chander Gari → Trek to Boga Lake (homestay with Bawm community) "
            "→ Summit Keokradong (1,230m) for sunrise.\n"
            "• Packing essentials: Quick-dry trek shoes with deep grip, leech socks, waterproof pouch for electronics, "
            "and electrolyte tablets.\n\n"
            "Recommended budget: ৳12,000 – ৳18,000 including licensed indigenous guide fees."
        )

    if "sajek" in prompt or "cloud" in prompt:
        return (
            "Sajek Valley cloud-country guide:\n\n"
            "• Travel: Take Khagrachari night bus, then join morning Army escort at Dighinala (9:30 AM or 1:30 PM).\n"
            "• Highlight: Early morning sunrise above the clouds at Konglak Hill.\n"
            "• Local dining: Bamboo shoot curries and traditional bamboo-baked chicken at local Marma/Tripura kitchens.\n"
            "• Recommended stay: 2 nights at a wooden hillside cottage facing the valley.\n\n"
            "Estimated budget: ৳5,800 – ৳8,500."
        )

    if "budget" in prompt or "cost" in prompt or "money" in prompt:
        return (
            "Here is a balanced BDT budget breakdown for travel in Bangladesh:\n\n"
            "1. Transport: 20-25% (AC sleeper buses ৳1,200-1,800 each way, or flights ৳4,000-6,500).\n"
            "2. Accommodation: 40% (Cozy eco-resorts & clean guest houses avg ৳2,500-4,000/night).\n"
            "3. Local food & guides: 25% (Generous budget for authentic local kitchens: ৳1,000-1,500/day).\n"
            "4. Buffer & souvenirs: 10-15%.\n\n"
            "Tip: Traveling mid-week reduces resort rates by up to 30%."
        )

    return (
        "That sounds like a wonderful travel spark! I recommend planning a slow, respectful itinerary "
        "focused on authentic regional experiences. Consider staying in locally owned eco-cottages, "
        "allocating ample room for slow mornings, and hiring certified community guides to explore hidden "
        "trails and waterways. Tell me your preferred duration or budget (in BDT) and I'll shape a full "
        "day-by-day itinerary for you!"
    )


def extract_latest_user_prompt(history: Union[List[dict], str]) -> str:
    """Extract the latest user prompt from conversation history or string."""
    if isinstance(history, str):
        return history
    if isinstance(history, list) and history:
        for msg in reversed(history):
            if isinstance(msg, dict):
                sender = msg.get("sender", "").upper()
                body = msg.get("body", "")
                if sender == "USER":
                    return body
            elif isinstance(msg, str):
                return msg
        last_item = history[-1]
        if isinstance(last_item, dict):
            return last_item.get("body", "")
        return str(last_item)
    return ""


def build_gemini_contents(
    history: Union[List[dict], str],
    last_n: int = LAST_N_MESSAGES,
) -> List[types.Content]:
    """Convert conversation history into Gemini types.Content objects, retaining the last N messages."""
    if isinstance(history, str):
        return [types.Content(role="user", parts=[types.Part.from_text(text=history)])]

    recent = history[-last_n:] if len(history) > last_n else history
    contents: List[types.Content] = []

    for msg in recent:
        if isinstance(msg, dict):
            sender = msg.get("sender", "").upper()
            role = "user" if sender == "USER" else "model"
            body = (msg.get("body") or "").strip()
            if not body:
                continue
            # Merge consecutive messages of the same role
            if contents and contents[-1].role == role:
                prev_text = contents[-1].parts[0].text or ""
                contents[-1].parts[0] = types.Part.from_text(text=f"{prev_text}\n{body}")
            else:
                contents.append(types.Content(role=role, parts=[types.Part.from_text(text=body)]))
        elif isinstance(msg, str) and msg.strip():
            body = msg.strip()
            if contents and contents[-1].role == "user":
                prev_text = contents[-1].parts[0].text or ""
                contents[-1].parts[0] = types.Part.from_text(text=f"{prev_text}\n{body}")
            else:
                contents.append(types.Content(role="user", parts=[types.Part.from_text(text=body)]))

    if not contents:
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text="Hello")]))

    # Gemini conversation must start with a user turn
    if contents[0].role == "model":
        if len(contents) > 1:
            contents.pop(0)
        else:
            contents.insert(
                0,
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text="Hello, please help plan travel in Bangladesh.")],
                ),
            )

    return contents


def generate_reply(
    history: Union[List[dict], str],
    client_instance: Optional[Any] = None,
) -> str:
    """
    Generate an assistant reply using the official Gemini SDK with automatic fallback.

    - Reads GEMINI_API_KEY and GEMINI_MODEL from config.
    - Sends up to LAST_N_MESSAGES as context history.
    - Uses 15-second timeout and structured Bangladesh travel system prompt.
    - If the API key is missing, empty, or if an API error occurs, falls back seamlessly
      to the deterministic rule-based Bangladesh travel synthesizer.
    """
    user_prompt = extract_latest_user_prompt(history)
    settings = get_settings()
    api_key = (settings.GEMINI_API_KEY or "").strip()

    # If no mock client provided and API key is not configured, fall back immediately
    if client_instance is None and not api_key:
        return fallback_rule_based_reply(user_prompt)

    try:
        if client_instance is None:
            client = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(timeout=15000),  # 15s timeout
            )
        else:
            client = client_instance

        contents = build_gemini_contents(history, last_n=LAST_N_MESSAGES)
        model_name = settings.GEMINI_MODEL or "gemini-2.5-flash"
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
        )

        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=config,
        )

        if response and response.text:
            return response.text.strip()

        logger.warning("Gemini returned empty response; using fallback reply.")
        return fallback_rule_based_reply(user_prompt)
    except Exception as exc:
        logger.warning(
            "Gemini generation failed (%s: %s). Falling back to rule-based reply.",
            type(exc).__name__,
            exc,
        )
        return fallback_rule_based_reply(user_prompt)


async def generate_reply_async(
    history: Union[List[dict], str],
    client_instance: Optional[Any] = None,
) -> str:
    """Async wrapper around generate_reply using asyncio.to_thread for non-blocking I/O."""
    return await asyncio.to_thread(generate_reply, history, client_instance)
