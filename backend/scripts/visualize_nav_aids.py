import sys
from pathlib import Path

import geopandas as gpd
import matplotlib.pyplot as plt
from sqlalchemy import create_engine

# Add the backend directory to sys.path to allow importing 'app'
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

try:
    from app.core.config import settings
except ImportError:
    print(
        "Error: Could not import app.core.config. Make sure you are running this from the backend directory or have it in your PYTHONPATH."
    )
    sys.exit(1)


def visualize_nav_aids():
    """
    Fetches radio navigation aids from PostGIS and visualizes them using Matplotlib on a white background.
    """
    # Construct synchronous database URL for SQLAlchemy/psycopg
    db_url = (
        f"postgresql+psycopg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    )

    print(f"Connecting to database at {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}...")
    engine = create_engine(db_url)

    # Query to fetch navigation aids
    query = "SELECT geom, aid_type, station_name, ident FROM radio_nav_aids"

    try:
        print("Fetching data from 'radio_nav_aids' table...")
        # Use geopandas to read PostGIS data
        df = gpd.read_postgis(query, engine, geom_col="geom")
    except Exception as e:
        print(f"Error fetching data: {e}")
        return

    if df.empty:
        print("No radio navigation aids found in the database.")
        return

    print(f"Successfully fetched {len(df)} navigation aids. Generating visualization...")

    # Set up the aesthetic style for a clean white background
    plt.style.use("seaborn-v0_8-muted")
    fig, ax = plt.subplots(figsize=(14, 10), dpi=100)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    # Define distinct colors for aid types
    aid_types = sorted(df["aid_type"].unique())

    # Using a professional categorical colormap
    cmap = plt.colormaps.get_cmap("Set1")

    # Markers mapping for aviation clarity
    marker_map = {
        "VOR": "H",  # Hexagon
        "NDB": "o",  # Circle
        "DME": "s",  # Square
        "VORTAC": "D",  # Diamond
        "TACAN": "^",  # Triangle
        "VORDME": "p",  # Pentagon
    }

    for i, aid_type in enumerate(aid_types):
        subset = df[df["aid_type"] == aid_type]
        marker = marker_map.get(aid_type, "P")  # Default to plus if unknown
        color = cmap(i / len(aid_types))

        subset.plot(
            ax=ax,
            label=aid_type,
            color=color,
            marker=marker,
            markersize=80,
            alpha=0.85,
            edgecolor="black",  # Dark edge for better contrast on white
            linewidth=0.8,
        )

    # Styling the plot
    ax.set_title(
        "Radio Navigation Aids Visualization",
        fontsize=20,
        fontweight="bold",
        pad=25,
        color="#333333",
    )
    ax.set_xlabel("Longitude (Decimal Degrees)", fontsize=13, labelpad=10)
    ax.set_ylabel("Latitude (Decimal Degrees)", fontsize=13, labelpad=10)

    # Add legend with custom positioning
    ax.legend(
        title="Aid Type",
        loc="upper left",
        bbox_to_anchor=(1, 1),
        fontsize=11,
        title_fontsize=13,
        frameon=True,
        facecolor="#f8f8f8",
        edgecolor="#cccccc",
    )

    # Add a clean grid
    ax.grid(True, linestyle="-", alpha=0.15, color="gray")

    # Ensure the axis spines are clean
    for spine in ax.spines.values():
        spine.set_edgecolor("#aaaaaa")
        spine.set_linewidth(1)

    # Save the output
    output_path = Path(__file__).parent / "nav_aids_plot_white.png"
    plt.savefig(output_path, bbox_inches="tight", facecolor=fig.get_facecolor())
    print(f"\nSuccess! Visualization saved to: {output_path.resolve()}")


if __name__ == "__main__":
    visualize_nav_aids()
