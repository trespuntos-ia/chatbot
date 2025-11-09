import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const REQUIRED_FIELDS = [
  'component',
  'purpose',
  'role',
  'objective',
  'context',
  'audience',
  'task',
  'restrictions',
  'tone'
] as const;

type RequiredField = typeof REQUIRED_FIELDS[number];

const FIELD_LABELS: Record<RequiredField, string> = {
  component: 'Componente que debe generar la IA',
  purpose: 'Descripción y propósito',
  role: 'Rol',
  objective: 'Objetivo',
  context: 'Contexto',
  audience: 'Audiencia',
  task: 'Tarea',
  restrictions: 'Restricciones',
  tone: 'Tono'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    return;
  }

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      res.status(500).json({
        success: false,
        error: 'OpenAI configuration missing',
        details: 'OPENAI_API_KEY is not configured'
      });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    const missingFields = REQUIRED_FIELDS.filter((field) => {
      const value = body[field];
      return !value || !String(value).trim();
    });

    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        error: `Faltan campos obligatorios: ${missingFields
          .map((field) => FIELD_LABELS[field])
          .join(', ')}`
      });
      return;
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const systemMessage =
      'Actúa como un Experto en Formulación de Instrucciones de IA. Tu tarea es tomar los siguientes elementos de prompt (Rol, Objetivo, Contexto, Audiencia, Tarea, Restricciones y Tono) y combinarlos en una única instrucción cohesiva y clara para el Modelo de Lenguaje Grande (LLM). Devuelve únicamente el prompt final, listo para usarse como mensaje del sistema.';

    const userMessage = `
Componente que debe generar la IA: ${body.component}
Descripción y propósito: ${body.purpose}
Rol: ${body.role}
Objetivo: ${body.objective}
Contexto: ${body.context}
Audiencia: ${body.audience}
Tarea: ${body.task}
Restricciones: ${body.restrictions}
Tono: ${body.tone}
`.trim();

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_PROMPT_MODEL || 'gpt-4.1-mini',
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: systemMessage
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    const generatedPrompt = completion.choices?.[0]?.message?.content?.trim();

    if (!generatedPrompt) {
      res.status(500).json({
        success: false,
        error: 'OpenAI no devolvió un resultado válido'
      });
      return;
    }

    res.status(200).json({
      success: true,
      prompt: generatedPrompt
    });
  } catch (error) {
    console.error('Error generating system prompt:', error);

    res.status(500).json({
      success: false,
      error: 'Error interno al generar el prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

