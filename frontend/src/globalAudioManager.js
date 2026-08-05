/**
 * globalAudioManager — singleton blokujący równoległe odtwarzanie audio
 *
 * Zapewnia, że w całej aplikacji nigdy nie gra więcej niż jedna instancja
 * Audio jednocześnie. Każde nowe odtwarzanie automatycznie zatrzymuje poprzednie.
 */

const globalAudioManager = (() => {
  let _currentAudio = null;
  let _currentRequestId = 0;

  return {
    /**
     * Zatrzymuje poprzednie audio i zwraca nowe requestId dla tej sesji.
     * Zawsze udane — każde wywołanie przerywa poprzednie odtwarzanie.
     */
    acquire() {
      if (_currentAudio) {
        try { _currentAudio.pause(); } catch (e) {}
        _currentAudio = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
      _currentRequestId++;
      return _currentRequestId;
    },

    /**
     * Rejestruje aktywny element Audio po zakończeniu fetch.
     * Zwraca false gdy requestId jest nieaktualny (inny acquire() zdążył).
     */
    setAudio(requestId, audioElement) {
      if (requestId !== _currentRequestId) {
        try { audioElement.pause(); } catch (e) {}
        return false;
      }
      if (_currentAudio) {
        try { _currentAudio.pause(); } catch (e) {}
      }
      _currentAudio = audioElement;
      return true;
    },

    /**
     * Sprawdza czy dany requestId jest wciąż aktualny.
     */
    isValid(requestId) {
      return requestId === _currentRequestId;
    },

    /**
     * Zatrzymuje wszystko i inwaliduje wszystkie aktywne requesty.
     * Wywołaj przy Reset / Stop / zmianie ekranu.
     */
    stopAll() {
      if (_currentAudio) {
        try { _currentAudio.pause(); } catch (e) {}
        _currentAudio = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
      _currentRequestId++;
    },

    /**
     * Zwalnia slot po zakończeniu odtwarzania (wywołaj w onended).
     */
    release(requestId) {
      if (requestId === _currentRequestId) {
        _currentAudio = null;
      }
    },

    get currentAudio() { return _currentAudio; },
    get currentRequestId() { return _currentRequestId; },
  };
})();

export default globalAudioManager;
