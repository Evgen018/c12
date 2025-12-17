import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { content, mode } = await request.json();

    // Валидация входных данных
    if (!content || typeof content !== "string") {
      console.error("AI Process: Content validation failed - content is missing or not a string");
      return NextResponse.json(
        { 
          error: "Content is required",
          details: "Content must be a non-empty string"
        },
        { status: 400 }
      );
    }

    if (content.trim().length === 0) {
      console.error("AI Process: Content validation failed - content is empty");
      return NextResponse.json(
        { 
          error: "Content cannot be empty",
          details: "Content must contain at least some text"
        },
        { status: 400 }
      );
    }

    if (!mode || !["about", "thesis", "telegram"].includes(mode)) {
      console.error("AI Process: Mode validation failed - invalid mode:", mode);
      return NextResponse.json(
        { 
          error: "Invalid mode",
          details: "Mode must be one of: 'about', 'thesis', or 'telegram'"
        },
        { status: 400 }
      );
    }

    // Ограничиваем длину контента для AI (примерно 8000 токенов)
    const maxLength = 30000; // примерно 8000 токенов
    let contentToProcess = content;
    let wasTruncated = false;
    
    if (content.length > maxLength) {
      contentToProcess = content.substring(0, maxLength) + "\n\n[... текст обрезан из-за ограничений длины ...]";
      wasTruncated = true;
      console.warn(`AI Process: Content truncated from ${content.length} to ${maxLength} characters for mode: ${mode}`);
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("AI Process: OPENROUTER_API_KEY is not set in environment variables");
      return NextResponse.json(
        { 
          error: "OpenRouter API key is not configured",
          details: "Please set OPENROUTER_API_KEY in your environment variables. Check your .env.local file or Vercel environment variables."
        },
        { status: 500 }
      );
    }

    // Логируем начало обработки
    console.log(`AI Process: Starting processing for mode "${mode}", content length: ${contentToProcess.length}${wasTruncated ? " (truncated)" : ""}`);

    // Формируем промпт в зависимости от режима
    let systemPrompt = "";
    let userPrompt = "";

    switch (mode) {
      case "about":
        systemPrompt = `Ты профессиональный аналитик текстов. Твоя задача - создать краткое, но информативное описание статьи на русском языке.

Требования:
- Объем: 2-3 абзаца (примерно 150-250 слов)
- Язык: только русский
- Структура: первый абзац - о чем статья, второй - основные идеи, третий (опционально) - важные выводы
- Стиль: профессиональный, но доступный
- Не добавляй лишних комментариев, только описание статьи`;

        userPrompt = `Проанализируй следующую статью и напиши краткое описание на русском языке (2-3 абзаца):

${contentToProcess}

Важно: Ответ должен быть только на русском языке, без предисловий и комментариев.`;
        break;
      
      case "thesis":
        systemPrompt = `Ты эксперт по структурированию информации. Твоя задача - извлечь ключевые тезисы из статьи и представить их в виде нумерованного списка на русском языке.

Требования:
- Формат: нумерованный список (1., 2., 3., ...)
- Количество: 5-10 тезисов (в зависимости от объема статьи)
- Каждый тезис: 1-2 предложения, четко формулирующие мысль
- Язык: только русский
- Приоритет: самые важные и значимые идеи статьи
- Без дополнительных комментариев, только список тезисов`;

        userPrompt = `Извлеки основные тезисы из следующей статьи и представь их в виде нумерованного списка на русском языке:

${contentToProcess}

Важно: Ответ должен быть только нумерованным списком на русском языке, без предисловий.`;
        break;
      
      case "telegram":
        systemPrompt = `Ты профессиональный копирайтер для социальных сетей. Твоя задача - создать готовый пост для Telegram на основе статьи.

Требования:
- Длина: 200-400 слов (оптимально для Telegram)
- Язык: только русский
- Структура: 
  * Заголовок/первая строка (привлекающая внимание)
  * Основной текст (информативный, легко читаемый)
  * Призыв к действию или вывод (опционально)
- Эмодзи: используй 3-5 эмодзи для визуального оформления, но не переусердствуй
- Стиль: живой, интересный, но профессиональный
- Форматирование: используй переносы строк для читаемости
- Без хештегов и ссылок (только текст)
- Готов к публикации без дополнительного редактирования`;

        userPrompt = `Создай готовый пост для Telegram на основе следующей статьи. Пост должен быть интересным, информативным и готовым к публикации:

${contentToProcess}

Важно: 
- Пост должен быть на русском языке
- Используй эмодзи для оформления (3-5 штук)
- Сделай пост привлекательным и легко читаемым
- Без предисловий, только готовый пост`;
        break;
    }

    // Вызываем OpenRouter API для AI-обработки
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Article AI Processor",
      },
      body: JSON.stringify({
        model: "mistralai/devstral-2512:free",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        // Параметры для контроля длины и качества ответа
        max_tokens: mode === "telegram" ? 800 : mode === "about" ? 600 : 1000,
        temperature: 0.7, // Баланс между креативностью и точностью
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error("AI Process: OpenRouter API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        mode: mode,
        contentLength: contentToProcess.length,
      });
      
      // Более информативные сообщения об ошибках
      let userFriendlyError = `Ошибка при обработке запроса к AI сервису`;
      if (response.status === 401) {
        userFriendlyError = "Ошибка аутентификации с AI сервисом. Проверьте API ключ.";
      } else if (response.status === 429) {
        userFriendlyError = "Превышен лимит запросов к AI сервису. Попробуйте позже.";
      } else if (response.status === 500 || response.status >= 502) {
        userFriendlyError = "Временная ошибка AI сервиса. Попробуйте позже.";
      }
      
      return NextResponse.json(
        { 
          error: userFriendlyError,
          details: errorData.message || errorText || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status
        },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid response structure:", JSON.stringify(data, null, 2));
      return NextResponse.json(
        { 
          error: "Invalid response from AI service",
          details: "Response structure is not as expected"
        },
        { status: 500 }
      );
    }

    const result = data.choices[0].message.content;

    if (!result) {
      console.error("AI Process: Empty result received from AI", {
        mode: mode,
        responseData: JSON.stringify(data, null, 2),
      });
      return NextResponse.json(
        { 
          error: "Пустой ответ от AI сервиса",
          details: "AI сервис вернул пустой результат. Попробуйте еще раз или проверьте контент статьи."
        },
        { status: 500 }
      );
    }

    // Логируем успешное завершение
    console.log(`AI Process: Successfully processed for mode "${mode}", result length: ${result.length}`);

    return NextResponse.json({
      result: result,
      mode: mode,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("AI Process: Unexpected error:", {
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      { 
        error: "Неожиданная ошибка при обработке",
        details: process.env.NODE_ENV === "development" 
          ? errorMessage 
          : "Произошла ошибка при обработке запроса. Попробуйте еще раз.",
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

