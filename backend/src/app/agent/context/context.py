import time
from dataclasses import dataclass, field

@dataclass
class ZekContext:
    token: str = ""  # user's JWT from the frontend (empty for guest users)