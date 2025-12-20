import { NextRequest, NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";

export async function POST(request: NextRequest) {
  try {
    const { content, language = "ru" } = await request.json();

    // Валидация входных данных
    if (!content || typeof content !== "string") {
      console.error("Generate Image: Content validation failed - content is missing or not a string");
      return NextResponse.json(
        { 
          error: "Content is required",
          details: "Content must be a non-empty string"
        },
        { status: 400 }
      );
    }

    if (content.trim().length === 0) {
      console.error("Generate Image: Content validation failed - content is empty");
      return NextResponse.json(
        { 
          error: "Content cannot be empty",
          details: "Content must contain at least some text"
        },
        { status: 400 }
      );
    }

    // Ограничиваем длину контента для AI (примерно 8000 токенов)
    const maxLength = 30000;
    let contentToProcess = content;
    let wasTruncated = false;
    
    if (content.length > maxLength) {
      contentToProcess = content.substring(0, maxLength) + "\n\n[... текст обрезан из-за ограничений длины ...]";
      wasTruncated = true;
      console.warn(`Generate Image: Content truncated from ${content.length} to ${maxLength} characters`);
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      console.error("Generate Image: OPENROUTER_API_KEY is not set in environment variables");
      return NextResponse.json(
        { 
          error: "OpenRouter API key is not configured",
          details: "Please set OPENROUTER_API_KEY in your environment variables"
        },
        { status: 500 }
      );
    }

    // Проверяем наличие API ключей (Hugging Face или Replicate)
    const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
    const replicateApiKey = process.env.REPLICATE_API_TOKEN;
    
    if (!huggingFaceApiKey && !replicateApiKey) {
      console.error("Generate Image: Neither HUGGINGFACE_API_KEY nor REPLICATE_API_TOKEN is set");
      return NextResponse.json(
        { 
          error: "API key is not configured",
          details: "Please set either HUGGINGFACE_API_KEY or REPLICATE_API_TOKEN in your .env.local file. For Replicate (recommended), get a free token at https://replicate.com"
        },
        { status: 500 }
      );
    }
    
    // Если нет Hugging Face ключа, сразу пробуем Replicate
    if (!huggingFaceApiKey && replicateApiKey) {
      console.log("Generate Image: No Hugging Face key, using Replicate API directly");
      // Пропускаем Hugging Face и переходим к Replicate ниже
    }

    const isMontenegrin = language === "me";

    // Шаг 1: Создаем промпт для изображения через OpenRouter API
    console.log("Generate Image: Creating image prompt via OpenRouter API");
    
    const promptSystemMessage = isMontenegrin
      ? `Ti si ekspert za kreiranje detaljnih i kreativnih opisa slika. Tvoja zadaća je da kreiraš kratak, ali detaljan prompt za generisanje ilustracije na osnovu članka.

Zahtjevi:
- Prompt mora biti na engleskom jeziku (za bolje rezultate AI modela za generisanje slika)
- Dužina: 50-100 riječi
- Opisuj vizuelne elemente: predmet, pozadinu, stil, atmosferu
- Budi specifičan i kreativan
- Fokusiraj se na glavnu temu članka
- Ne dodavaj nepotrebne detalje`
      : `Ты эксперт по созданию детальных и креативных описаний изображений. Твоя задача - создать краткий, но детальный промпт для генерации иллюстрации на основе статьи.

Требования:
- Промпт должен быть на английском языке (для лучших результатов AI модели генерации изображений)
- Длина: 50-100 слов
- Описывай визуальные элементы: предмет, фон, стиль, атмосферу
- Будь конкретным и креативным
- Фокусируйся на главной теме статьи
- Не добавляй лишних деталей`;

    const promptUserMessage = isMontenegrin
      ? `Kreiraj detaljan prompt na engleskom jeziku za generisanje ilustracije na osnovu sljedećeg članka. Prompt treba da opiše vizuelne elemente, stil i atmosferu koja odgovara glavnoj temi članka.

Članak:
${contentToProcess}

VAŽNO: 
- Odgovor mora biti SAMO prompt na engleskom jeziku
- Bez markdown formata (bez **, *, #, itd.)
- Bez dodatnih komentara, objašnjenja ili labela
- Samo čist tekst opisa slike`
      : `Создай детальный промпт на английском языке для генерации иллюстрации на основе следующей статьи. Промпт должен описать визуальные элементы, стиль и атмосферу, соответствующую главной теме статьи.

Статья:
${contentToProcess}

ВАЖНО: 
- Ответ должен быть ТОЛЬКО промптом на английском языке
- Без markdown форматирования (без **, *, #, и т.д.)
- Без дополнительных комментариев, объяснений или меток
- Только чистый текст описания изображения`;

    // Вызываем OpenRouter API для создания промпта
    const promptResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openRouterApiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Article Illustration Generator"
      },
      body: JSON.stringify({
        model: "mistralai/devstral-2512:free",
        messages: [
          {
            role: "system",
            content: promptSystemMessage
          },
          {
            role: "user",
            content: promptUserMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      })
    });

    if (!promptResponse.ok) {
      const errorText = await promptResponse.text();
      console.error("Generate Image: OpenRouter API error:", promptResponse.status, errorText);
      return NextResponse.json(
        { 
          error: "Failed to create image prompt",
          details: `OpenRouter API returned status ${promptResponse.status}`
        },
        { status: promptResponse.status }
      );
    }

    const promptData = await promptResponse.json();
    let imagePrompt = promptData.choices?.[0]?.message?.content?.trim();

    if (!imagePrompt || imagePrompt.length === 0) {
      console.error("Generate Image: Empty prompt received from OpenRouter");
      return NextResponse.json(
        { 
          error: "Failed to create image prompt",
          details: "OpenRouter API returned empty prompt"
        },
        { status: 500 }
      );
    }

    // Очищаем промпт от markdown форматирования и лишних символов
    imagePrompt = imagePrompt
      .replace(/^\*\*Prompt:\*\*/i, '') // Убираем **Prompt:**
      .replace(/^\*\*[Pp]rompt\*\*:?\s*/i, '') // Убираем **Prompt**:
      .replace(/^[Pp]rompt:?\s*/i, '') // Убираем Prompt:
      .replace(/\*\*/g, '') // Убираем все **
      .replace(/\*/g, '') // Убираем все *
      .replace(/#{1,6}\s*/g, '') // Убираем заголовки markdown
      .replace(/^[-•]\s*/gm, '') // Убираем маркеры списков
      .replace(/^\d+\.\s*/gm, '') // Убираем нумерацию
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.match(/^(важно|important|note|примечание):?/i))
      .join(' ') // Объединяем в одну строку для промпта изображения
      .trim();

    console.log("Generate Image: Prompt created:", imagePrompt.substring(0, 100) + "...");

    // Шаг 2: Генерируем изображение через Hugging Face API
    console.log("Generate Image: Generating image via Hugging Face API");
    
    // Сначала пробуем использовать официальный InferenceClient SDK
    if (huggingFaceApiKey) {
      try {
        console.log("Generate Image: Trying Hugging Face InferenceClient SDK");
        const client = new InferenceClient(huggingFaceApiKey);
        
        const hfModel = process.env.HUGGINGFACE_MODEL || "stabilityai/stable-diffusion-xl-base-1.0";
        // Provider может быть: "nscale", "fal", "together", или не указан (используется по умолчанию)
        const provider = process.env.HUGGINGFACE_PROVIDER || "nscale";
        
        console.log(`Generate Image: Using model ${hfModel} with provider ${provider}`);
        
        // Пробуем с provider, если не работает - пробуем без provider
        let imageBlob: Blob;
        try {
          const result: any = await client.textToImage({
            provider: provider as any,
            model: hfModel,
            inputs: imagePrompt,
            parameters: { 
              num_inference_steps: parseInt(process.env.HUGGINGFACE_STEPS || "20")
            }
          });
          // textToImage возвращает Blob
          imageBlob = result as Blob;
        } catch (providerError) {
          console.log("Generate Image: Provider failed, trying without provider");
          try {
            // Пробуем без provider
            const result: any = await client.textToImage({
              model: hfModel,
              inputs: imagePrompt,
              parameters: { 
                num_inference_steps: parseInt(process.env.HUGGINGFACE_STEPS || "20")
              }
            });
            imageBlob = result as Blob;
          } catch (noProviderError) {
            throw noProviderError; // Пробрасываем ошибку дальше
          }
        }
        
        // Конвертируем Blob в base64
        const arrayBuffer = await imageBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        
        // Определяем MIME тип (обычно PNG для Stable Diffusion)
        const imageDataUrl = `data:image/png;base64,${base64Image}`;
        
        console.log("Generate Image: Image generated successfully via InferenceClient SDK");
        
        return NextResponse.json({
          success: true,
          image: imageDataUrl,
          prompt: imagePrompt,
          provider: "huggingface-sdk"
        });
      } catch (sdkError: any) {
        const errorMessage = sdkError?.message || String(sdkError);
        console.error("Generate Image: InferenceClient SDK error:", errorMessage);
        
        // Проверяем, является ли это ошибкой прав доступа
        if (errorMessage.includes("sufficient permissions") || errorMessage.includes("authentication") || errorMessage.includes("permissions")) {
          console.error("Generate Image: ⚠️ API token doesn't have permissions for Inference Providers");
          console.error("Generate Image: Solution 1: Create a new token at https://huggingface.co/settings/tokens with 'Inference Providers' permission");
          console.error("Generate Image: Solution 2: Use Replicate API instead (add REPLICATE_API_TOKEN to .env.local)");
          console.error("Generate Image: Replicate is recommended - get free token at https://replicate.com");
        }
        
        console.log("Generate Image: Falling back to direct API calls and Replicate");
        // Продолжаем с прямыми API вызовами и Replicate
      }
    }
    
    // Используем модель из переменной окружения или по умолчанию
    // 
    // Как выбрать модель:
    // 1. Перейдите на https://huggingface.co/models
    // 2. Отфильтруйте по Task: "Text-to-Image"
    // 3. Выберите модель с поддержкой Inference API
    // 4. Скопируйте название модели (например: "runwayml/stable-diffusion-v1-5")
    // 5. Добавьте в .env.local: HUGGINGFACE_MODEL=название_модели
    //
    // Популярные модели:
    // - stabilityai/stable-diffusion-xl-base-1.0 (по умолчанию, высокое качество)
    // - runwayml/stable-diffusion-v1-5 (быстрая, надежная)
    // - CompVis/stable-diffusion-v1-4 (классическая)
    // - stabilityai/sdxl-turbo (быстрая генерация)
    // - stabilityai/stable-diffusion-2-1 (версия 2.1)
    // - stabilityai/stable-diffusion-2-1-base (базовая версия 2.1)
    //
    // ВАЖНО: Если api-inference.huggingface.co возвращает 410, код автоматически
    // попробует альтернативные модели через router.huggingface.co. Если все модели не работают,
    // возможно нужно использовать Inference Endpoints (платная услуга) или другой сервис.
    const hfModel = process.env.HUGGINGFACE_MODEL || "stabilityai/stable-diffusion-xl-base-1.0";
    console.log("Generate Image: Using model:", hfModel);
    
    // Список моделей для попытки (включая основную и альтернативные)
    const modelsToTry = [
      hfModel,
      process.env.HUGGINGFACE_ALTERNATIVE_MODEL || "runwayml/stable-diffusion-v1-5",
      "CompVis/stable-diffusion-v1-4",
      "stabilityai/sdxl-turbo",
      "stabilityai/stable-diffusion-2-1",
      "stabilityai/stable-diffusion-2-1-base"
    ];
    
    // Убираем дубликаты
    const uniqueModels = [...new Set(modelsToTry)];
    
    let imageResponse: Response | null = null;
    let apiUrl = "";
    let success = false;
    let lastError: { status: number; details: string } | null = null;
    
    // Пробуем каждую модель через router.huggingface.co (новый API)
    for (const model of uniqueModels) {
      if (success) break;
      
      console.log(`Generate Image: Trying model: ${model} via router.huggingface.co`);
      
      // Пробуем router.huggingface.co (новый API)
      apiUrl = `https://router.huggingface.co/models/${model}`;
      
      try {
        imageResponse = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${huggingFaceApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            inputs: imagePrompt
          })
        });
        
        // Если получили успешный ответ или 503 (модель загружается), используем эту модель
        if (imageResponse.ok || imageResponse.status === 503) {
          console.log(`Generate Image: Model ${model} responded with status ${imageResponse.status}`);
          success = true;
          break;
        } else {
          const errorText = await imageResponse.text();
          lastError = { status: imageResponse.status, details: errorText };
          console.log(`Generate Image: Model ${model} returned ${imageResponse.status}`);
          
          // Если это не 404, возможно модель доступна, но есть другая проблема
          if (imageResponse.status !== 404) {
            // Сохраняем этот ответ для дальнейшей обработки
            break;
          }
        }
      } catch (err) {
        console.error(`Generate Image: Error trying ${model}:`, err);
        continue;
      }
    }
    
    // Если router API не сработал, пробуем старый api-inference для всех моделей
    if (!success) {
      console.log("Generate Image: router.huggingface.co failed, trying api-inference.huggingface.co");
      
      for (const model of uniqueModels) {
        if (success) break;
        
        console.log(`Generate Image: Trying model: ${model} via api-inference.huggingface.co`);
        apiUrl = `https://api-inference.huggingface.co/models/${model}`;
        
        try {
          imageResponse = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${huggingFaceApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              inputs: imagePrompt
            })
          });
          
          if (imageResponse.ok || imageResponse.status === 503) {
            console.log(`Generate Image: Model ${model} via api-inference responded with status ${imageResponse.status}`);
            success = true;
            break;
          } else if (imageResponse.status !== 410) {
            // Если не 410, сохраняем для обработки
            const errorText = await imageResponse.text();
            lastError = { status: imageResponse.status, details: errorText };
            break;
          }
        } catch (err) {
          console.error(`Generate Image: Error trying ${model} via api-inference:`, err);
          continue;
        }
      }
    }
    
    // Если Hugging Face не сработал, пробуем Replicate API
    if (!success && !imageResponse && replicateApiKey) {
      console.error("Generate Image: All Hugging Face models and endpoints failed");
      console.error("Generate Image: Last error:", lastError);
      console.error("Generate Image: Trying Replicate API as alternative");
      console.log("Generate Image: Hugging Face failed, trying Replicate API");
      
      try {
        // Используем Replicate API для генерации изображения
        const replicateResponse = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            "Authorization": `Token ${replicateApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", // stable-diffusion-xl
            input: {
              prompt: imagePrompt,
              num_outputs: 1,
              aspect_ratio: "1:1",
              output_format: "png"
            }
          })
        });

        if (!replicateResponse.ok) {
          const errorText = await replicateResponse.text();
          console.error("Generate Image: Replicate API error:", replicateResponse.status, errorText);
        } else {
          const replicateData = await replicateResponse.json();
          console.log("Generate Image: Replicate prediction created:", replicateData.id);
          
          // Ждем завершения генерации
          let predictionStatus = replicateData.status;
          let predictionId = replicateData.id;
          let attempts = 0;
          const maxAttempts = 60; // максимум 60 попыток (около 2 минут)
          
          while (predictionStatus !== "succeeded" && predictionStatus !== "failed" && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // ждем 2 секунды
            
            const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
              headers: {
                "Authorization": `Token ${replicateApiKey}`
              }
            });
            
            const statusData = await statusResponse.json();
            predictionStatus = statusData.status;
            
            if (predictionStatus === "succeeded" && statusData.output && statusData.output[0]) {
              // Получаем изображение
              const imageUrl = statusData.output[0];
              const imageResponse = await fetch(imageUrl);
              const imageBlob = await imageResponse.blob();
              const arrayBuffer = await imageBlob.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const base64Image = buffer.toString('base64');
              const imageDataUrl = `data:image/png;base64,${base64Image}`;
              
              console.log("Generate Image: Image generated successfully via Replicate");
              
              return NextResponse.json({
                success: true,
                image: imageDataUrl,
                prompt: imagePrompt,
                provider: "replicate"
              });
            }
            
            attempts++;
          }
          
          if (predictionStatus === "failed") {
            console.error("Generate Image: Replicate prediction failed");
            return NextResponse.json(
              { 
                error: "Failed to generate image via Replicate",
                details: "Image generation failed"
              },
              { status: 500 }
            );
          }
          
          if (attempts >= maxAttempts) {
            console.error("Generate Image: Replicate prediction timeout");
            return NextResponse.json(
              { 
                error: "Image generation timeout",
                details: "Generation took too long, please try again"
              },
              { status: 504 }
            );
          }
        }
      } catch (replicateError) {
        console.error("Generate Image: Replicate API error:", replicateError);
      }
    }
    
    // Если ничего не сработало, возвращаем ошибку
    if (!success && !imageResponse) {
      const errorStatus = lastError?.status || 500;
      const errorDetails = lastError?.details || "Unable to connect to any image generation service";
      const replicateHint = replicateApiKey 
        ? "Replicate API also failed or is not configured correctly." 
        : "Consider adding REPLICATE_API_TOKEN to .env.local for alternative service (free tier available at replicate.com).";
      
      return NextResponse.json(
        { 
          error: "Failed to generate image",
          details: `All services failed. Last error: ${errorDetails.substring(0, 200)}. ${replicateHint}`
        },
        { status: errorStatus }
      );
    }

    if (!imageResponse || !imageResponse.ok) {
      if (!imageResponse) {
        return NextResponse.json(
          { 
            error: "Failed to generate image",
            details: "No response from Hugging Face API"
          },
          { status: 500 }
        );
      }
      
      const errorText = await imageResponse.text();
      console.error("Generate Image: Hugging Face API error:", imageResponse.status);
      console.error("Generate Image: Error details:", errorText);
      console.error("Generate Image: Used URL:", apiUrl);
      
      // Если модель еще загружается, возвращаем специальную ошибку
      if (imageResponse.status === 503) {
        return NextResponse.json(
          { 
            error: "Model is loading",
            details: "The image generation model is currently loading. Please try again in a few moments."
          },
          { status: 503 }
        );
      }
      
      // Если 410 - API больше не поддерживается
      if (imageResponse.status === 410) {
        return NextResponse.json(
          { 
            error: "API endpoint deprecated",
            details: "The Hugging Face API endpoint is no longer supported. Please check the API documentation for the correct endpoint."
          },
          { status: 410 }
        );
      }
      
      return NextResponse.json(
        { 
          error: "Failed to generate image",
          details: `Hugging Face API returned status ${imageResponse.status}: ${errorText.substring(0, 200)}`
        },
        { status: imageResponse.status }
      );
    }

    // Получаем ответ от API (imageResponse уже проверен выше)
    if (!imageResponse) {
      return NextResponse.json(
        { 
          error: "Failed to generate image",
          details: "No response from Hugging Face API"
        },
        { status: 500 }
      );
    }
    
    const contentType = imageResponse.headers.get("content-type");
    
    let imageDataUrl: string;
    
    if (contentType && contentType.startsWith("image/")) {
      // Если ответ - это изображение напрямую
      const imageBlob = await imageResponse.blob();
      const arrayBuffer = await imageBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Image = buffer.toString('base64');
      imageDataUrl = `data:${contentType};base64,${base64Image}`;
    } else {
      // Если ответ - это JSON с base64 изображением
      const jsonResponse = await imageResponse.json();
      
      if (jsonResponse.image) {
        // Если изображение уже в base64 формате
        imageDataUrl = jsonResponse.image.startsWith('data:') 
          ? jsonResponse.image 
          : `data:image/png;base64,${jsonResponse.image}`;
      } else if (jsonResponse.blob) {
        // Если есть blob
        imageDataUrl = jsonResponse.blob;
      } else {
        // Пробуем найти base64 в любом поле
        const base64Match = JSON.stringify(jsonResponse).match(/"([A-Za-z0-9+/=]{100,})"/);
        if (base64Match) {
          imageDataUrl = `data:image/png;base64,${base64Match[1]}`;
        } else {
          console.error("Generate Image: Could not find image in response", jsonResponse);
          return NextResponse.json(
            { 
              error: "Failed to extract image from response",
              details: "Unexpected response format from Hugging Face API"
            },
            { status: 500 }
          );
        }
      }
    }

    console.log("Generate Image: Image generated successfully");

    return NextResponse.json({
      success: true,
      image: imageDataUrl,
      prompt: imagePrompt
    });

  } catch (error) {
    console.error("Generate Image: Unexpected error:", error);
    return NextResponse.json(
      { 
        error: "Unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

