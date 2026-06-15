"""
Delete wind park CSVs from era5_data/ — EnviroTrust
Prints every file before deleting. Solar CSVs are untouched.
"""

from pathlib import Path

ERA5_DIR = Path("era5_data")

WIND_PARKS = [
    "Buergerwindpark_Reussenkoge",
    "Windpark_Holtriem",
    "Windpark_Kessin",
    "Windpark_Druiberg",
    "Hesselbach_Wind_Farm",
    "Windpark_Harz",
    "Windpark_Odervorland",
    "Windpark_Veenhusen",
    "Windpark_Hohe_Geest",
]

to_delete = [ERA5_DIR / f"{name}.csv" for name in WIND_PARKS]

print("Files to delete:")
for f in to_delete:
    if f.exists():
        print(f"  DELETE  {f}")
    else:
        print(f"  SKIP    {f}  (not found)")

confirm = input("\nType 'yes' to confirm deletion: ")
if confirm.strip().lower() != "yes":
    print("Aborted — nothing deleted.")
else:
    for f in to_delete:
        if f.exists():
            f.unlink()
            print(f"  Deleted {f.name}")
    print("Done.")
