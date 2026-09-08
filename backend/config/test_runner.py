"""
Test runner for the BulanTanom suite.

Wired up through TEST_RUNNER in settings, so `manage.py test` picks it up with
no extra flag - a speed-up nobody remembers to opt into is a speed-up nobody
gets, least of all CI.
"""

from django.conf import settings
from django.test.runner import DiscoverRunner


class FastTestRunner(DiscoverRunner):
    """
    Runs the suite with a deliberately cheap password hasher.

    PBKDF2 is slow on purpose: it exists to make an attacker holding a stolen
    database work for every guess. That cost is right in production and wrong
    in tests, where the suite creates Farmers, Officers and Admins in almost
    every setUp and then signs them in. The passwords are fixtures, they never
    leave the test database, and it is destroyed at the end of the run.

    Only the hasher is swapped. Authentication itself is exercised exactly as
    before, so a test that depends on a wrong password being rejected still
    proves that.
    """

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
