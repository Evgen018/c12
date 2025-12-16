import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Получаем HTML страницы
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = load(html);

    // Извлекаем заголовок
    let title = "";
    const titleSelectors = [
      "h1",
      "article h1",
      ".post-title",
      ".article-title",
      "[class*='title']",
      "title",
    ];
    for (const selector of titleSelectors) {
      const element = $(selector).first();
      if (element.length) {
        title = element.text().trim();
        if (title) break;
      }
    }

    // Извлекаем дату
    let date = "";
    const dateSelectors = [
      "time[datetime]",
      "time",
      "[class*='date']",
      "[class*='published']",
      "[class*='time']",
      "meta[property='article:published_time']",
      "meta[name='publish-date']",
    ];
    for (const selector of dateSelectors) {
      const element = $(selector).first();
      if (element.length) {
        if (selector.includes("meta")) {
          date = element.attr("content") || element.attr("property") || "";
        } else {
          date = element.attr("datetime") || element.text().trim();
        }
        if (date) break;
      }
    }

    // Извлекаем основной контент
    let content = "";
    const contentSelectors = [
      "article",
      ".post",
      ".content",
      ".article-content",
      "[class*='article']",
      "[class*='post-content']",
      "main",
    ];
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        // Удаляем скрипты, стили и другие ненужные элементы
        element.find("script, style, nav, aside, footer, header").remove();
        content = element.text().trim();
        if (content && content.length > 100) break;
      }
    }

    // Если не нашли контент, пробуем body
    if (!content || content.length < 100) {
      const body = $("body");
      body.find("script, style, nav, aside, footer, header").remove();
      content = body.text().trim();
    }

    return NextResponse.json({
      date: date || null,
      title: title || null,
      content: content || null,
    });
  } catch (error) {
    console.error("Error parsing article:", error);
    return NextResponse.json(
      { error: "Failed to parse article", details: String(error) },
      { status: 500 }
    );
  }
}

