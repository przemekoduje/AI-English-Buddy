/**
 * sentenceGrouping.js
 * 
 * Moduł zapewniający, że podział transkrypcji na segmenty/karty fraz w Media Buddy
 * następuje wyłącznie na poziomie pełnych zdań – nigdy nie urywa ani nie dzieli zdań.
 */

// Typowe skróty w języku angielskim zakończone kropką, które NIE kończą zdania
export const ABBREVIATIONS = new Set([
  "mr.", "mrs.", "ms.", "dr.", "prof.", "sr.", "jr.", "vs.", "e.g.", "i.e.",
  "etc.", "st.", "u.s.", "u.k.", "gen.", "gov.", "jan.", "feb.", "mar.", "apr.",
  "jun.", "jul.", "aug.", "sept.", "oct.", "nov.", "dec.", "a.m.", "p.m.", "no.", "vol."
]);

/**
 * Sprawdza, czy dany fragment tekstu kończy pełne zdanie w języku angielskim.
 * Ignoruje cudzysłowy i nawiasy zamykające na końcu, sprawdza czy przed kropką nie stoi skrót.
 */
export const isSentenceEnd = (text) => {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Samodzielne znaczniki dźwiękowe, np. (Laughter), [Music], (Applause)
  if ((trimmed.startsWith("(") && trimmed.endsWith(")")) || 
      (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return true;
  }

  // Usuwamy ewentualne cudzysłowy, nawiasy zamykające na samym końcu
  const stripped = trimmed.replace(/["'”’)\]]+$/, "");
  if (!stripped) return false;

  const lastChar = stripped[stripped.length - 1];
  if (lastChar === "." || lastChar === "?" || lastChar === "!") {
    const words = stripped.split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();
    if (ABBREVIATIONS.has(lastWord)) {
      return false;
    }
    return true;
  }
  return false;
};

/**
 * Dzieli pojedynczy blok tekstu zawierający wiele zdań na tablicę pojedynczych, pełnych zdań.
 * Respektuje skróty i cudzysłowy.
 */
export const splitBlockIntoSentences = (text) => {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Szukamy sekwencji kończących zdanie (.?! wraz z opcjonalnymi cudzysłowami)
  // poprzedzających spację i kolejną wielką literę / cyfrę / cudzysłów
  const regex = /(.+?[.?!]["'”’)]?)(?:\s+(?=[A-Z0-9"'“(])|$)/g;
  const matches = [];
  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    if (match[1]) matches.push(match[1].trim());
  }

  if (matches.length === 0) {
    return [trimmed];
  }

  // Weryfikacja pod kątem skrótów (np. Mr. Smith nie powinno być dzielone)
  const sentences = [];
  let buffer = "";
  for (const m of matches) {
    const candidate = buffer ? `${buffer} ${m}` : m;
    const stripped = candidate.replace(/["'”’)\]]+$/, "");
    if (stripped && (stripped.endsWith(".") || stripped.endsWith("?") || stripped.endsWith("!"))) {
      const words = stripped.split(/\s+/);
      const lastWord = words[words.length - 1].toLowerCase();
      if (ABBREVIATIONS.has(lastWord)) {
        buffer = candidate;
        continue;
      }
    }
    sentences.push(candidate);
    buffer = "";
  }

  if (buffer) {
    if (sentences.length > 0) {
      sentences[sentences.length - 1] = `${sentences[sentences.length - 1]} ${buffer}`;
    } else {
      sentences.push(buffer);
    }
  }

  return sentences;
};

/**
 * Główna funkcja normalizująca dowolną tablicę segmentów transkrypcji [{start, end, text}].
 * Gwarantuje:
 * 1. Każdy zwrócony element reprezentuje DOKŁADNIE JEDNO PEŁNE ZDANIE.
 * 2. Żadne zdanie nie jest urywane ani dzielone na części.
 * 3. Segmenty urwane w połowie zdania są łączone w spójną całość.
 * 4. Bloki zawierające wiele zdań są rozdzielane z proporcjonalnymi znacznikami czasu.
 */
export const ensureCompleteSentences = (rawTranscript) => {
  if (!Array.isArray(rawTranscript) || rawTranscript.length === 0) {
    return [];
  }

  // Filtrujemy puste segmenty oraz nagłówki techniczne transkrybentów
  const cleaned = rawTranscript.filter(seg => {
    if (!seg || !seg.text) return false;
    const t = seg.text.trim();
    if (!t) return false;
    if (t.includes("Transcriber:") && t.includes("Reviewer:")) return false;
    return true;
  });

  if (cleaned.length === 0) return [];

  // Krok 1: Łączenie kolejnych segmentów aż do momentu napotkania znaku końca zdania
  const mergedBlocks = [];
  let current = null;

  for (let i = 0; i < cleaned.length; i++) {
    const seg = cleaned[i];
    const text = seg.text.trim();

    if (!current) {
      current = {
        start: seg.start,
        end: seg.end,
        text: text
      };
    } else {
      current.end = seg.end;
      // Łączenie słów z uwzględnieniem łączników i apostrofów
      if (current.text.endsWith("-") || text.startsWith("'")) {
        current.text = `${current.text}${text}`;
      } else {
        current.text = `${current.text} ${text}`;
      }
    }

    if (isSentenceEnd(current.text)) {
      mergedBlocks.push(current);
      current = null;
    }
  }

  // Jeśli cokolwiek zostało na końcu (np. film zakończył się bez kropki), zachowaj jako ostatnie zdanie
  if (current) {
    mergedBlocks.push(current);
  }

  // Krok 2: Upewnienie się, że jeśli scalony blok zawiera wiele pełnych zdań,
  // zostanie on rozbity na pojedyncze zdania z proporcjonalnymi znacznikami czasu
  const finalSentences = [];
  for (const block of mergedBlocks) {
    const sents = splitBlockIntoSentences(block.text);
    if (sents.length <= 1) {
      finalSentences.push({
        start: Math.round(block.start * 100) / 100,
        end: Math.round(block.end * 100) / 100,
        text: block.text.replace(/\s+/g, " ").trim()
      });
    } else {
      const totalChars = sents.reduce((acc, s) => acc + s.length, 0);
      const duration = Math.max(0, block.end - block.start);
      let currStart = block.start;
      for (let j = 0; j < sents.length; j++) {
        const s = sents[j].replace(/\s+/g, " ").trim();
        const sFraction = totalChars > 0 ? s.length / totalChars : 1 / sents.length;
        const sEnd = j === sents.length - 1 ? block.end : currStart + sFraction * duration;
        finalSentences.push({
          start: Math.round(currStart * 100) / 100,
          end: Math.round(sEnd * 100) / 100,
          text: s
        });
        currStart = sEnd;
      }
    }
  }

  return finalSentences;
};

export default ensureCompleteSentences;
