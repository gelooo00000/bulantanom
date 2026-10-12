"""
Catches sign-up email addresses that cannot possibly receive mail, before a
verification code is sent to nowhere.

Two checks, both about the part after the "@":

* a typo of a common provider ("gmial.com"), answered with a suggestion;
* a domain with no mail server at all ("asdfgh.com"), found with a DNS
  lookup for its MX record (or, failing that, an address record, which RFC
  5321 lets mail fall back to).

What this cannot do is tell whether one mailbox exists at a real provider:
Gmail answers the same for "juan@gmail.com" and "xkq93@gmail.com". The
emailed code is what proves that — an address nobody reads never gets it,
so its account can never be used.

A DNS failure (timeout, no network) lets the address through: the code step
still stands behind it, and a farmer must never be turned away because a
lookup was slow.
"""

from __future__ import annotations

import logging

from django.conf import settings

logger = logging.getLogger(__name__)

# Misspellings seen in the wild for the providers farmers actually use.
COMMON_TYPOS = {
    "gmial.com": "gmail.com",
    "gmai.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmal.com": "gmail.com",
    "gmail.co": "gmail.com",
    "gmail.con": "gmail.com",
    "gmail.cm": "gmail.com",
    "gmail.om": "gmail.com",
    "gmaill.com": "gmail.com",
    "gnail.com": "gmail.com",
    "gmail.comm": "gmail.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yahoo.con": "yahoo.com",
    "hotmal.com": "hotmail.com",
    "hotmail.con": "hotmail.com",
    "outlok.com": "outlook.com",
    "outlook.con": "outlook.com",
}

NOWHERE_MESSAGE = (
    "This email address could not be found. Check it for typos — "
    "we need to send a verification code to it."
)


def _domain_receives_mail(domain: str) -> bool | None:
    """True/False from DNS; None when DNS could not answer either way."""
    import dns.exception
    import dns.resolver

    resolver = dns.resolver.Resolver()
    resolver.lifetime = 4.0
    try:
        answers = resolver.resolve(domain, "MX")
        # A "null MX" (RFC 7505, a single "." host) says: no mail here.
        return any(str(r.exchange) not in (".", "") for r in answers)
    except dns.resolver.NXDOMAIN:
        return False
    except dns.resolver.NoAnswer:
        pass  # No MX: mail may still go to the domain's own address.
    except (dns.exception.DNSException, OSError) as exc:
        logger.info("MX lookup for %s inconclusive: %s", domain, exc)
        return None

    for record_type in ("A", "AAAA"):
        try:
            resolver.resolve(domain, record_type)
            return True
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            continue
        except (dns.exception.DNSException, OSError) as exc:
            logger.info("%s lookup for %s inconclusive: %s", record_type, domain, exc)
            return None
    return False


def email_problem(email: str) -> str | None:
    """
    A message for the farmer if `email` clearly cannot receive mail, else
    None. Expects an already lower-cased, syntactically valid address.
    """
    domain = email.rsplit("@", 1)[-1]

    suggestion = COMMON_TYPOS.get(domain)
    if suggestion:
        local = email.rsplit("@", 1)[0]
        return f"Did you mean {local}@{suggestion}? Check the email address for typos."

    if not getattr(settings, "EMAIL_DOMAIN_CHECK", True):
        return None
    if _domain_receives_mail(domain) is False:
        return NOWHERE_MESSAGE
    return None
