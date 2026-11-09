from typing import List, Union


def generate_reply(history: Union[List[dict], str]) -> str:
    """Generate an assistant reply from conversation history or prompt.

    This function serves as the single LLM swap point. It can be easily updated
    later to connect to Gemini, OpenAI, Claude, or any external model provider.
    Currently implements the deterministic Bangladesh travel synthesis rules.
    """
    if isinstance(history, str):
        user_prompt = history
    elif isinstance(history, list) and history:
        # Extract the latest user prompt from conversation history
        user_prompt = ""
        for msg in reversed(history):
            if isinstance(msg, dict):
                sender = msg.get("sender", "").upper()
                body = msg.get("body", "")
                if sender == "USER" or not user_prompt:
                    user_prompt = body
                    if sender == "USER":
                        break
            elif isinstance(msg, str):
                user_prompt = msg
                break
    else:
        user_prompt = ""

    prompt = user_prompt.lower()

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
