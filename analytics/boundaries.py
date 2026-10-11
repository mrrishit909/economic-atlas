"""Boundary-change table. Event years are general historical knowledge (GENERAL_KNOWLEDGE); first observed years are computed from data.

territory_break_year: a year after which the territory covered by the WDI series for this iso3 plausibly differs from before.
Countries whose break falls inside (start, end] of a window are excluded from that window's primary sample (sensitivity run keeps them).
Successor states (USSR, Yugoslavia, Czechoslovakia) have no break: WDI reports reconstructed early values on the successor territory;
they enter a window only if observed at its start year. WDI documentation for these reconstructions was not machine-readable here (UNVERIFIED).
"""
from __future__ import annotations

# iso3, entity, event, event_year, territory_break_year, sensitivity_only, treatment
ROWS = [
    ("SDN", "Sudan", "South Sudan seceded", 2011, 2011, False, "Series spans the pre-2011 territory; excluded from primary windows containing 2011, kept in sensitivity run."),
    ("SSD", "South Sudan", "Independence from Sudan", 2011, None, True, "Starts after independence; no pre-2011 history; absent from windows starting before its first year."),
    ("ETH", "Ethiopia", "Eritrea independent (de facto 1991, formal 1993)", 1993, 1993, False, "Series before 1993 may include Eritrea; excluded from primary windows containing 1993."),
    ("ERI", "Eritrea", "Independence from Ethiopia", 1993, None, True, "Short, ends in 2011 in WDI; dropped from windows lacking start or end data."),
    ("SRB", "Serbia", "Serbia and Montenegro dissolved", 2006, 2006, False, "Series history may cover the union; excluded from primary windows containing 2006."),
    ("MNE", "Montenegro", "Independence from Serbia and Montenegro", 2006, None, True, "Starts when WDI reports it; dropped from windows lacking start data."),
    ("XKX", "Kosovo", "Declared independence from Serbia", 2008, None, True, "WDI series starts 2008; not in windows starting earlier."),
    ("DEU", "Germany", "Reunification", 1990, 1991, False, "First full unified year 1991; excluded from primary windows that start before 1991 (includes the 1960 and 1980 constant-USD windows and the 1990 PPP window)."),
    ("YEM", "Yemen", "North and South Yemen unified", 1990, 1990, False, "Pre-1990 constant-USD history may combine two states; excluded from the 1960 and 1980 windows."),
    ("PAK", "Pakistan", "Bangladesh independence", 1971, 1971, False, "Pre-1972 territory included East Pakistan; excluded from the 1960 window."),
    ("BGD", "Bangladesh", "Independence from Pakistan", 1971, 1971, False, "Pre-1972 history may be a reconstruction; excluded from the 1960 window."),
    ("CZE", "Czechia", "Czechoslovakia dissolved", 1993, None, False, "WDI reports successor-territory values from 1990 (reconstruction); included when observed at window start."),
    ("SVK", "Slovak Republic", "Czechoslovakia dissolved", 1993, None, False, "As Czechia."),
    ("RUS", "Russian Federation", "USSR dissolved", 1991, None, False, "Reconstructed values for 1990 onwards; included when observed at window start. 15 successor states share this treatment."),
    ("UKR", "Ukraine", "USSR dissolved", 1991, None, False, "As Russian Federation."),
    ("HRV", "Croatia", "Yugoslavia dissolved", 1991, None, False, "Reconstructed early values; included when observed at window start. The six successor states share this treatment."),
    ("SVN", "Slovenia", "Yugoslavia dissolved", 1991, None, False, "As Croatia."),
    ("MKD", "North Macedonia", "Yugoslavia dissolved", 1991, None, False, "As Croatia."),
    ("BIH", "Bosnia and Herzegovina", "Yugoslavia dissolved", 1992, None, False, "As Croatia."),
    ("TLS", "Timor-Leste", "Independence from Indonesia", 2002, None, False, "WDI series starts before independence; included when observed at window start, with the caveat that early values are for a non-sovereign territory."),
    ("CUW", "Curacao", "Netherlands Antilles dissolved", 2010, None, True, "Starts 2000; not in windows starting earlier."),
    ("SXM", "Sint Maarten (Dutch part)", "Netherlands Antilles dissolved", 2010, None, True, "Starts 2009; not in windows starting earlier."),
]
BREAKS = {r[0]: r[4] for r in ROWS if r[4] is not None}


def breaks_in_window(start: int, end: int) -> list[str]:
    return sorted(i for i, b in BREAKS.items() if start < b <= end)
