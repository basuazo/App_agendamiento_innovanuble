import { google } from 'googleapis';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const isConfigured = !!(CALENDAR_ID && SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY);

function getCalendarClient() {
  if (!isConfigured) return null;

  const auth = new google.auth.JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  return google.calendar({ version: 'v3', auth });
}

const COLOR_MAP: Record<string, string> = {
  mesa_corte: '11',      // Rojo tomate
  escritorio: '2',       // Verde salvia
  computador: '9',       // Azul
  impresora_3d: '6',     // Mandarina
  sala_reuniones: '3',   // Morado uva
};

interface CreateEventParams {
  summary: string;
  description: string;
  startTime: Date;
  endTime: Date;
  resourceType: string;
}

export async function createCalendarEvent(params: CreateEventParams): Promise<string | null> {
  const calendar = getCalendarClient();
  if (!calendar) {
    console.log('Google Calendar no configurado, omitiendo sincronización.');
    return null;
  }

  try {
    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID!,
      requestBody: {
        summary: params.summary,
        description: params.description,
        start: {
          dateTime: params.startTime.toISOString(),
          timeZone: 'America/Santiago',
        },
        end: {
          dateTime: params.endTime.toISOString(),
          timeZone: 'America/Santiago',
        },
        colorId: COLOR_MAP[params.resourceType] ?? '1',
      },
    });

    return response.data.id ?? null;
  } catch (error) {
    console.error('Error al crear evento en Google Calendar:', error);
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = getCalendarClient();
  if (!calendar) return;

  try {
    await calendar.events.delete({
      calendarId: CALENDAR_ID!,
      eventId,
    });
  } catch (error) {
    console.error('Error al eliminar evento de Google Calendar:', error);
  }
}
