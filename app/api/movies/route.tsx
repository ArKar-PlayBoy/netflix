import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get("ids")?.split(",").map(Number).filter(n => !isNaN(n)) || [];

    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const movies = await Promise.all(
      ids.map((id) =>
        fetch(`https://api.themoviedb.org/3/movie/${id}?language=en-US`, {
          headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}` },
          next: { revalidate: 86400 },
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );

    return NextResponse.json({ success: true, data: movies });
  } catch (err) {
    console.error("[Movies API] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch movies" }, { status: 500 });
  }
}
