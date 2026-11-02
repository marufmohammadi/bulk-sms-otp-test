export async function safeFetchJson<T = any>(
  res: Response
): Promise<{ ok: boolean; status: number; data: T }> {
  const text = await res.text();
  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    // If the response is HTML or plain text instead of JSON
    const cleanText = text
      .replace(/<[^>]*>?/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    data = {
      error:
        cleanText.length > 0 && cleanText.length < 200
          ? cleanText
          : `Server returned non-JSON response (${res.status} ${res.statusText}).`,
    };
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}
