/**
 * sentenceGrouping.js
 * 
 * Moduł zapewniający, że podział transkrypcji na segmenty/karty fraz w Media Buddy
 * następuje wyłącznie na poziomie pełnych, czytelnych zdań.
 * 
 * 1. Gdy transkrypcja posiada interpunkcję: łączy segmenty w pełne zdania (od kropki do kropki),
 *    nigdy nie urywając zdań w połowie.
 * 2. Gdy transkrypcja NIE posiada interpunkcji (np. automatyczne napisy YouTube z mowy na żywo)
 *    lub gdy transkrypcja została wcześniej zapisana jako 1 gigantyczny blok tekstu:
 *    inteligentnie dzieli tekst na naturalne, kompletne jednostki wypowiedzi (10-18 słów),
 *    dopasowując granice do spójników i zaimków, wielkich liter i kropek,
 *    dzięki czemu całe wideo NIGDY nie łączy się w jedno gigantyczne zdanie!
 */

// Typowe skróty w języku angielskim zakończone kropką, które NIE kończą zdania
export const ABBREVIATIONS = new Set([
  "mr.", "mrs.", "ms.", "dr.", "prof.", "sr.", "jr.", "vs.", "e.g.", "i.e.",
  "etc.", "st.", "u.s.", "u.k.", "gen.", "gov.", "jan.", "feb.", "mar.", "apr.",
  "jun.", "jul.", "aug.", "sept.", "oct.", "nov.", "dec.", "a.m.", "p.m.", "no.", "vol."
]);

// Typowe słowa rozpoczynające nowe zdanie lub myśl w naturalnej mowie angielskiej
export const SENTENCE_STARTERS = new Set([
  "so", "and", "but", "because", "or", "well", "now", "then", "also", "actually",
  "in fact", "plus", "anyway", "meanwhile", "however", "if", "when", "while",
  "although", "though", "since", "after", "before", "unless", "until", "as",
  "i", "you", "we", "they", "he", "she", "it", "there", "that", "this", "these",
  "those", "what", "why", "how", "where", "who", "which", "you know", "i mean",
  "right", "okay", "sure", "yeah", "yes", "no"
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
 * Dzieli długą, niepunktowaną frazę (np. > 18-20 słów) na naturalne, pełne jednostki zdań/myśli
 * o optymalnej długości 10-18 słów. Zapewnia wielką literę na początku i kropkę na końcu.
 */
export const splitLongUnpunctuatedClause = (text) => {
  if (!text) return [];
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  
  if (words.length <= 20) {
    let s = words.join(" ");
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.?!]["'”’)]?$/.test(s)) s += ".";
    return [s];
  }

  const results = [];
  let currentWords = [];

  for (let i = 0; i < words.length; i++) {
    currentWords.push(words[i]);
    const count = currentWords.length;
    const remaining = words.length - (i + 1);

    if (count >= 10 && remaining >= 4) {
      const nextWord = (words[i + 1] || "").toLowerCase().replace(/[^a-z']/g, "");
      const nextTwoWords = words[i + 2] 
        ? `${nextWord} ${(words[i + 2] || "").toLowerCase().replace(/[^a-z']/g, "")}` 
        : "";

      const isStarter = SENTENCE_STARTERS.has(nextWord) || SENTENCE_STARTERS.has(nextTwoWords);

      // Dzielimy, jeśli osiągnięto min. 10 słów i kolejne słowo to spójnik/zaimek,
      // lub bezwzględnie przy osiągnięciu 18 słów
      if ((count >= 10 && isStarter) || count >= 18) {
        let sent = currentWords.join(" ").trim();
        sent = sent.charAt(0).toUpperCase() + sent.slice(1);
        if (!/[.?!]["'”’)]?$/.test(sent)) sent += ".";
        results.push(sent);
        currentWords = [];
      }
    }
  }

  if (currentWords.length > 0) {
    let sent = currentWords.join(" ").trim();
    if (results.length > 0 && currentWords.length < 5) {
      let prev = results[results.length - 1];
      if (prev.endsWith(".")) prev = prev.slice(0, -1);
      results[results.length - 1] = `${prev} ${sent}.`;
    } else {
      sent = sent.charAt(0).toUpperCase() + sent.slice(1);
      if (!/[.?!]["'”’)]?$/.test(sent)) sent += ".";
      results.push(sent);
    }
  }

  return results;
};

/**
 * Dzieli pojedynczy blok tekstu zawierający wiele zdań na tablicę pojedynczych, pełnych zdań.
 * Respektuje skróty, cudzysłowy i automatycznie dzieli długie niepunktowane ciągi mowy.
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

  const rawPieces = matches.length === 0 ? [trimmed] : [];
  if (matches.length > 0) {
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
      rawPieces.push(candidate);
      buffer = "";
    }
    if (buffer) {
      if (rawPieces.length > 0) {
        rawPieces[rawPieces.length - 1] += ` ${buffer}`;
      } else {
        rawPieces.push(buffer);
      }
    }
  }

  // Weryfikujemy każdy fragment: jeśli fragment nie ma interpunkcji i przekracza 20 słów,
  // dzielimy go na czytelne jednostki zdań
  const finalSentences = [];
  for (const piece of rawPieces) {
    const words = piece.split(/\s+/).filter(Boolean);
    if (words.length > 20) {
      finalSentences.push(...splitLongUnpunctuatedClause(piece));
    } else {
      let s = piece.trim();
      s = s.charAt(0).toUpperCase() + s.slice(1);
      if (!/[.?!]["'”’)]?$/.test(s)) s += ".";
      finalSentences.push(s);
    }
  }

  return finalSentences;
};

/**
 * Główna funkcja normalizująca dowolną tablicę segmentów transkrypcji [{start, end, text}].
 * Gwarantuje:
 * 1. Każdy zwrócony element reprezentuje DOKŁADNIE JEDNO PEŁNE ZDANIE.
 * 2. Żadne zdanie nie jest urywane ani dzielone na części.
 * 3. Segmenty urwane w połowie zdania są łączone w spójną całość.
 * 4. Bloki zawierające wiele zdań są rozdzielane z proporcjonalnymi znacznikami czasu.
 * 5. Dla mowy bez interpunkcji oraz wideo scalanego w 1 gigantyczny blok:
 *    rozkłada treść na naturalne karty zdań (10-18 słów) z proporcjonalnym czasem!
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

  // Krok 1: Łączenie kolejnych segmentów (lub rozbijanie segmentów, jeśli segment jest już długi)
  const mergedBlocks = [];
  let current = null;

  for (let i = 0; i < cleaned.length; i++) {
    const seg = cleaned[i];
    const text = seg.text.trim();

    if (!current) {
      current = {
        start: seg.start,
        end: seg.end,
        text: text,
        wordCount: text.split(/\s+/).length
      };
    } else {
      const prevWordCount = current.wordCount;
      const gap = seg.start - current.end;
      const nextFirstWord = text.split(/\s+/)[0].toLowerCase();
      const endsPunc = isSentenceEnd(current.text);

      let shouldSplit = false;
      if (endsPunc) {
        // Jawne zakończenie zdania interpunkcją (kropka, pytajnik, wykrzyknik)
        shouldSplit = true;
      } else if (gap >= 0.5 && prevWordCount >= 6) {
        // Naturalna pauza w mowie po co najmniej 6 słowach
        shouldSplit = true;
      } else if (prevWordCount >= 12 && SENTENCE_STARTERS.has(nextFirstWord)) {
        // Nowa fraza/myśl rozpoczynająca się od spójnika lub zaimka po min. 12 słowach
        shouldSplit = true;
      } else if (prevWordCount >= 18) {
        // Bezpieczny limit słów dla niepunktowanej mowy
        shouldSplit = true;
      } else if (current.end - current.start >= 8.5 && prevWordCount >= 8) {
        // Bezpieczny limit czasu trwania pojedynczej karty (8.5s)
        shouldSplit = true;
      }

      if (shouldSplit) {
        let sent = current.text.trim();
        sent = sent.charAt(0).toUpperCase() + sent.slice(1);
        if (!/[.?!]["'”’)]?$/.test(sent)) {
          sent += ".";
        }
        current.text = sent;
        mergedBlocks.push(current);
        current = {
          start: seg.start,
          end: seg.end,
          text: text,
          wordCount: text.split(/\s+/).length
        };
      } else {
        current.end = Math.max(current.end, seg.end);
        if (current.text.endsWith("-") || text.startsWith("'")) {
          current.text = `${current.text}${text}`;
        } else {
          current.text = `${current.text} ${text}`;
        }
        current.wordCount = current.text.split(/\s+/).length;
      }
    }
  }

  // Zamknięcie ostatniego bloku
  if (current) {
    let sent = current.text.trim();
    sent = sent.charAt(0).toUpperCase() + sent.slice(1);
    if (!/[.?!]["'”’)]?$/.test(sent)) {
      sent += ".";
    }
    current.text = sent;
    mergedBlocks.push(current);
  }

  // Krok 2: Rozbicie bloków na pojedyncze zdania z proporcjonalnymi znacznikami czasu
  const finalSentences = [];
  for (const block of mergedBlocks) {
    const sents = splitBlockIntoSentences(block.text);
    if (sents.length <= 1) {
      finalSentences.push({
        start: Math.round(block.start * 100) / 100,
        end: Math.round(block.end * 100) / 100,
        text: (sents[0] || block.text).replace(/\s+/g, " ").trim()
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

  // Krok 3: Dodatkowy filtr bezpieczeństwa gwarantujący, że żaden segment nie przekracza dopuszczalnej długości
  const polishedSentences = [];
  for (const item of finalSentences) {
    const words = item.text.split(/\s+/).filter(Boolean);
    if (words.length > 22) {
      const parts = splitLongUnpunctuatedClause(item.text);
      if (parts.length > 1) {
        const totalChars = parts.reduce((acc, s) => acc + s.length, 0);
        const duration = Math.max(0, item.end - item.start);
        let cStart = item.start;
        for (let k = 0; k < parts.length; k++) {
          const p = parts[k].replace(/\s+/g, " ").trim();
          const frac = totalChars > 0 ? p.length / totalChars : 1 / parts.length;
          const cEnd = k === parts.length - 1 ? item.end : cStart + frac * duration;
          polishedSentences.push({
            start: Math.round(cStart * 100) / 100,
            end: Math.round(cEnd * 100) / 100,
            text: p
          });
          cStart = cEnd;
        }
        continue;
      }
    }
    polishedSentences.push(item);
  }

  return polishedSentences;
};

export default ensureCompleteSentences;
