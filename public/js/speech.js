class AgySpeech {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.currentInput = null;
        this.currentBtn = null;
        this.baseText = '';

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = navigator.language || 'it-IT';

            this.recognition.onstart = () => {
                this.isRecording = true;
                if (this.currentBtn) this.currentBtn.classList.add('recording');
                if (this.currentInput) this.baseText = this.currentInput.value;
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                if (this.currentBtn) this.currentBtn.classList.remove('recording');
            };

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    interimTranscript += event.results[i][0].transcript;
                }
                if (interimTranscript && this.currentInput) {
                    const separator = this.baseText && !this.baseText.endsWith(' ') ? ' ' : '';
                    this.currentInput.value = this.baseText + (this.baseText ? separator : '') + interimTranscript;
                    this.currentInput.focus();
                }
            };

            this.recognition.onerror = (event) => {
                console.warn('[Speech] Errore riconoscimento vocale:', event.error);
                this.isRecording = false;
                if (this.currentBtn) this.currentBtn.classList.remove('recording');
            };
        }
    }

    toggle(inputId = 'prompt-input', btnId = 'voice-btn') {
        if (!this.recognition) {
            alert('Il riconoscimento vocale non è supportato da questo browser.');
            return;
        }

        this.currentInput = document.getElementById(inputId);
        this.currentBtn = document.getElementById(btnId);

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch (e) {
                console.error(e);
            }
        }
    }

    toggleForChat() {
        this.toggle('chat-prompt-input', 'voice-btn-chat');
    }
}

window.agySpeech = new AgySpeech();
