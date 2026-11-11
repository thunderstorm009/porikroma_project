import html
import logging
from typing import Optional, Tuple
import httpx
from app.config import get_settings

logger = logging.getLogger("porikroma.email")


def _render_base_email(
    preheader: str,
    heading: str,
    body_paragraphs: list[str],
    action_url: Optional[str] = None,
    action_label: Optional[str] = None,
    meta_info: Optional[list[Tuple[str, str]]] = None,
) -> str:
    """Render a clean, responsive, brand-styled HTML email wrapper."""
    meta_html = ""
    if meta_info:
        items = "".join(
            f"""
            <tr style="border-bottom: 1px solid #edf2ec;">
                <td style="padding: 8px 0; color: #6d7770; font-size: 13px;">{html.escape(k)}</td>
                <td style="padding: 8px 0; color: #1e3a2b; font-weight: 600; font-size: 13px; text-align: right;">{html.escape(str(v))}</td>
            </tr>
            """
            for k, v in meta_info
        )
        meta_html = f"""
        <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background: #fbfdfa; border: 1px solid #e2ece0; border-radius: 8px; padding: 12px 16px;">
            <tbody>
                {items}
            </tbody>
        </table>
        """

    paragraphs_html = "".join(
        f'<p style="margin: 0 0 14px; font-size: 14px; line-height: 1.6; color: #35443a;">{html.escape(p)}</p>'
        for p in body_paragraphs
    )

    action_html = ""
    if action_url and action_label:
        action_html = f"""
        <div style="margin: 24px 0 20px; text-align: center;">
            <a href="{html.escape(action_url)}" target="_blank"
               style="background-color: #1e3a2b; color: #f6f7f2; text-decoration: none; padding: 12px 26px; border-radius: 7px; font-weight: 600; font-size: 14px; display: inline-block;">
                {html.escape(action_label)}
            </a>
        </div>
        <p style="font-size: 11px; color: #889988; margin: 12px 0 0; text-align: center; word-break: break-all;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="{html.escape(action_url)}" style="color: #15803d; text-decoration: underline;">{html.escape(action_url)}</a>
        </p>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{html.escape(heading)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <div style="display: none; max-height: 0px; overflow: hidden;">{html.escape(preheader)}</div>
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 30px 16px;">
                <table role="presentation" style="width: 100%; max-width: 560px; background-color: #ffffff; border-radius: 12px; border: 1px solid #dce6da; overflow: hidden; box-shadow: 0 4px 12px rgba(27, 43, 33, 0.05);">
                    <!-- Brand Header -->
                    <tr>
                        <td style="background-color: #1e3a2b; padding: 22px 28px; text-align: left;">
                            <span style="font-family: serif; font-size: 22px; font-weight: 800; color: #f6f7f2; letter-spacing: 0.5px;">porikroma</span>
                            <span style="display: block; font-size: 10px; color: #b7ceb4; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px;">Bangladesh Travel Platform</span>
                        </td>
                    </tr>
                    <!-- Main Body -->
                    <tr>
                        <td style="padding: 30px 28px 24px;">
                            <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #1e3a2b;">{html.escape(heading)}</h1>
                            {paragraphs_html}
                            {meta_html}
                            {action_html}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8faf6; border-top: 1px solid #edf2ec; padding: 18px 28px; text-align: center; font-size: 11px; color: #7f8c81;">
                            <p style="margin: 0 0 6px;">&copy; Porikroma Tourism Platform · Preserving authentic travel in Bangladesh</p>
                            <p style="margin: 0;">This is an automated operational notification. Keep your account access secure.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# 1. TEMPLATES
# ---------------------------------------------------------------------------
def email_verification_template(verification_link: str, user_name: str = "Traveler") -> Tuple[str, str]:
    """Email verification template."""
    subject = "Verify your Porikroma account email"
    body = [
        f"Hi {user_name},",
        "Welcome to Porikroma! Please confirm your email address to complete your registration and begin planning journeys across Bangladesh.",
        "Click the link below to verify your email. This link is valid for 24 hours.",
    ]
    html_content = _render_base_email(
        preheader="Confirm your email to complete your Porikroma registration.",
        heading="Verify your email address",
        body_paragraphs=body,
        action_url=verification_link,
        action_label="Verify Email Address",
    )
    return subject, html_content


def password_reset_template(reset_link: str, user_name: str = "Traveler") -> Tuple[str, str]:
    """Password reset template without exposing raw tokens or passwords."""
    subject = "Reset your Porikroma account password"
    body = [
        f"Hi {user_name},",
        "We received a request to reset the password associated with your Porikroma account.",
        "Click the secure button below to choose a new password. This reset link expires in 1 hour.",
        "If you did not request a password reset, please ignore this email; your account remains secure.",
    ]
    html_content = _render_base_email(
        preheader="Reset instructions for your Porikroma password.",
        heading="Password Reset Request",
        body_paragraphs=body,
        action_url=reset_link,
        action_label="Reset Password",
    )
    return subject, html_content


def booking_confirmed_template(
    traveler_name: str,
    tour_title: str,
    departure_date: str,
    seats: int,
    total_price: int,
    booking_id: str,
    bookings_link: str,
) -> Tuple[str, str]:
    """Booking confirmed template."""
    subject = f"Booking Confirmed: {tour_title}"
    body = [
        f"Hi {traveler_name},",
        f"Great news! Your booking for '{tour_title}' has been confirmed by the tour planner.",
        "Here are your reservation details:",
    ]
    meta = [
        ("Tour", tour_title),
        ("Departure Date", departure_date),
        ("Seats Reserved", str(seats)),
        ("Total Price", f"৳{total_price:,}"),
        ("Booking Reference", booking_id[:8]),
    ]
    html_content = _render_base_email(
        preheader=f"Your booking for {tour_title} on {departure_date} is confirmed.",
        heading="Booking Confirmed!",
        body_paragraphs=body,
        action_url=bookings_link,
        action_label="View My Bookings",
        meta_info=meta,
    )
    return subject, html_content


def booking_cancelled_template(
    traveler_name: str,
    tour_title: str,
    departure_date: str,
    reason: str,
    tours_link: str,
) -> Tuple[str, str]:
    """Booking cancelled template."""
    subject = f"Booking Update: {tour_title} Cancelled"
    body = [
        f"Hi {traveler_name},",
        f"Your booking for '{tour_title}' (Departure: {departure_date}) has been cancelled.",
    ]
    if reason:
        body.append(f"Reason: {reason}")
    body.append("Browse other upcoming expeditions and curated group tours across Bangladesh:")

    html_content = _render_base_email(
        preheader=f"Your booking for {tour_title} has been cancelled.",
        heading="Booking Cancelled",
        body_paragraphs=body,
        action_url=tours_link,
        action_label="Explore Other Tours",
    )
    return subject, html_content


def group_application_approved_template(
    applicant_name: str,
    group_title: str,
    trip_link: str,
) -> Tuple[str, str]:
    """Group application approved template."""
    subject = f"Application Approved: Welcome to {group_title}!"
    body = [
        f"Hi {applicant_name},",
        f"Congratulations! Your application to join the expedition group '{group_title}' has been approved by the organizer.",
        "You now have access to the trip workspace, group chat, itinerary collaboration, and shared expenses.",
    ]
    html_content = _render_base_email(
        preheader=f"You have been approved to join {group_title}.",
        heading="Welcome to the Expedition!",
        body_paragraphs=body,
        action_url=trip_link,
        action_label="Open Trip Workspace",
    )
    return subject, html_content


def group_application_rejected_template(
    applicant_name: str,
    group_title: str,
    groups_link: str,
) -> Tuple[str, str]:
    """Group application rejected template."""
    subject = f"Application Update: {group_title}"
    body = [
        f"Hi {applicant_name},",
        f"Thank you for your interest in joining '{group_title}'. The organizer was unable to accept your application for this expedition due to capacity or route constraints.",
        "There are many other active travel groups and expeditions heading to beautiful destinations across Bangladesh.",
    ]
    html_content = _render_base_email(
        preheader=f"Update regarding your application for {group_title}.",
        heading="Expedition Application Update",
        body_paragraphs=body,
        action_url=groups_link,
        action_label="Browse Other Groups",
    )
    return subject, html_content


def departure_reminder_template(
    traveler_name: str,
    tour_title: str,
    departure_date: str,
    meeting_point: str,
    details_link: str,
) -> Tuple[str, str]:
    """Departure reminder template."""
    subject = f"Departure Reminder: {tour_title} departs {departure_date}"
    body = [
        f"Hi {traveler_name},",
        f"Your upcoming expedition '{tour_title}' departs soon on {departure_date}!",
        "Please review meeting points, pack appropriate gear, and bring your NID or passport for check-post verifications.",
    ]
    meta = [
        ("Tour", tour_title),
        ("Departure Date", departure_date),
        ("Meeting Location", meeting_point or "Check tour workspace details"),
    ]
    html_content = _render_base_email(
        preheader=f"Departure reminder for {tour_title} on {departure_date}.",
        heading="Your Tour Departs Soon!",
        body_paragraphs=body,
        action_url=details_link,
        action_label="Review Expedition Details",
        meta_info=meta,
    )
    return subject, html_content


# ---------------------------------------------------------------------------
# 2. CORE EMAIL SENDER & PROVIDER SWITCHING
# ---------------------------------------------------------------------------
async def send_email(
    to: str,
    subject: str,
    html_body: str,
    client_instance: Optional[httpx.AsyncClient] = None,
) -> bool:
    """
    Send an email via configured provider (Resend, Postmark, or console fallback).

    Env:
      EMAIL_PROVIDER: 'resend', 'postmark', or 'console'
      EMAIL_API_KEY: provider token
      EMAIL_FROM: sender address
    """
    settings = get_settings()
    provider = (settings.EMAIL_PROVIDER or "resend").lower().strip()
    api_key = (settings.EMAIL_API_KEY or "").strip()
    sender = settings.EMAIL_FROM or "Porikroma <notifications@porikroma.com>"

    # Fallback to console if no API key or provider is 'console'
    if client_instance is None and (not api_key or provider == "console"):
        logger.info("[EMAIL CONSOLE DISPATCH] Provider: %s | To: %s | Subject: %s", provider, to, subject)
        print(f"\n======================================================\n"
              f"[EMAIL CONSOLE DISPATCH]\n"
              f"Provider : {provider}\n"
              f"To       : {to}\n"
              f"From     : {sender}\n"
              f"Subject  : {subject}\n"
              f"------------------------------------------------------\n"
              f"{html_body[:300]}...\n"
              f"======================================================\n")
        return True

    try:
        if provider == "postmark":
            url = "https://api.postmarkapp.com/email"
            headers = {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Postmark-Server-Token": api_key,
            }
            payload = {
                "From": sender,
                "To": to,
                "Subject": subject,
                "HtmlBody": html_body,
            }
        else:  # Default: Resend
            url = "https://api.resend.com/emails"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "from": sender,
                "to": [to],
                "subject": subject,
                "html": html_body,
            }

        async def _dispatch(client: httpx.AsyncClient):
            return await client.post(url, json=payload, headers=headers)

        if client_instance is not None:
            resp = await _dispatch(client_instance)
        else:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await _dispatch(client)

        if resp.status_code in (200, 201, 202):
            logger.info("Email delivered successfully to %s via %s (status %d)", to, provider, resp.status_code)
            return True
        else:
            logger.warning(
                "Email provider %s returned status %d (%s). Falling back to console dispatch.",
                provider,
                resp.status_code,
                resp.text[:200],
            )
            print(f"[EMAIL CONSOLE FALLBACK] To: {to} | Subject: {subject}")
            return False

    except Exception as exc:
        logger.warning(
            "Email sending error with %s (%s: %s). Falling back to console dispatch.",
            provider,
            type(exc).__name__,
            exc,
        )
        print(f"[EMAIL CONSOLE FALLBACK] To: {to} | Subject: {subject}")
        return False


# ---------------------------------------------------------------------------
# 3. CONVENIENT BACKGROUND WORKERS
# ---------------------------------------------------------------------------
async def send_verification_email(to: str, verification_link: str, user_name: str = "Traveler") -> bool:
    subject, html_body = email_verification_template(verification_link, user_name)
    return await send_email(to, subject, html_body)


async def send_password_reset_email(to: str, reset_link: str, user_name: str = "Traveler") -> bool:
    subject, html_body = password_reset_template(reset_link, user_name)
    return await send_email(to, subject, html_body)


async def send_booking_confirmed_email(
    to: str,
    traveler_name: str,
    tour_title: str,
    departure_date: str,
    seats: int,
    total_price: int,
    booking_id: str,
) -> bool:
    settings = get_settings()
    bookings_link = f"{settings.FRONTEND_URL}/my-bookings"
    subject, html_body = booking_confirmed_template(
        traveler_name, tour_title, departure_date, seats, total_price, booking_id, bookings_link
    )
    return await send_email(to, subject, html_body)


async def send_booking_cancelled_email(
    to: str,
    traveler_name: str,
    tour_title: str,
    departure_date: str,
    reason: str = "",
) -> bool:
    settings = get_settings()
    tours_link = f"{settings.FRONTEND_URL}/tours"
    subject, html_body = booking_cancelled_template(
        traveler_name, tour_title, departure_date, reason, tours_link
    )
    return await send_email(to, subject, html_body)


async def send_group_application_approved_email(
    to: str,
    applicant_name: str,
    group_title: str,
    trip_id: str,
) -> bool:
    settings = get_settings()
    trip_link = f"{settings.FRONTEND_URL}/trips/{trip_id}"
    subject, html_body = group_application_approved_template(
        applicant_name, group_title, trip_link
    )
    return await send_email(to, subject, html_body)


async def send_group_application_rejected_email(
    to: str,
    applicant_name: str,
    group_title: str,
) -> bool:
    settings = get_settings()
    groups_link = f"{settings.FRONTEND_URL}/community"
    subject, html_body = group_application_rejected_template(
        applicant_name, group_title, groups_link
    )
    return await send_email(to, subject, html_body)


async def send_departure_reminder_email(
    to: str,
    traveler_name: str,
    tour_title: str,
    departure_date: str,
    meeting_point: str = "",
    booking_id: str = "",
) -> bool:
    settings = get_settings()
    details_link = f"{settings.FRONTEND_URL}/my-bookings"
    subject, html_body = departure_reminder_template(
        traveler_name, tour_title, departure_date, meeting_point, details_link
    )
    return await send_email(to, subject, html_body)
