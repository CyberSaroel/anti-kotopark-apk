/**
 * NavigationService — единая система навигации для Socio-Cats.
 *
 * Управляет переходами между экранами, историей, кнопкой «Назад» (браузер
 * и Android) и обработкой модальных окон.
 */

const NavigationService = {
  root: null,
  currentScreen: null,
  previousScreen: null,
  history: [],          // [{ id, render }]
  _currentRender: null, // re-render function for the current screen
  _onLeave: null,       // cleanup callback for the current screen
  _onModalBack: null,   // back-button handler for the active modal overlay
  modalOpen: false,
  _backButtonHandler: null,
  _popstateHandler: null,

  /**
   * Инициализация сервиса. Вызывается один раз при старте.
   * @param {HTMLElement} root — контейнер #app
   */
  init(root) {
    this.root = root;
    this.currentScreen = null;
    this.previousScreen = null;
    this.history = [];
    this._currentRender = null;
    this.modalOpen = false;

    // Поддержка кнопки «Назад» браузера (popstate)
    this._popstateHandler = () => {
      if (this.modalOpen) {
        if (this._onModalBack) {
          const fn = this._onModalBack;
          this._onModalBack = null;
          fn();
        }
        return;
      }
      this.goBack();
    };
    window.addEventListener("popstate", this._popstateHandler);

    // Поддержка аппаратной кнопки «Назад» Android (Capacitor)
    this._initAndroidBackButton();
  },

  /**
   * Инициализировать обработчик аппаратной кнопки «Назад» Android.
   * Работает только внутри Capacitor-приложения.
   * В браузере — тихо игнорируется.
   */
  _initAndroidBackButton() {
    try {
      import("@capacitor/app").then(({ App }) => {
        this._backButtonHandler = () => {
          if (this.modalOpen) {
            if (this._onModalBack) {
              const fn = this._onModalBack;
              this._onModalBack = null;
              fn();
            }
            return;
          }
          this.goBack();
        };
        App.addListener("backButton", this._backButtonHandler);
      }).catch(() => {
        // Не Capacitor — игнорируем
      });
    } catch {
      // Не Capacitor — игнорируем
    }
  },

  /**
   * Зарегистрировать обработчик аппаратной/браузерной кнопки «Назад»
   * для активного модального окна (победа/импичмент).
   * @param {Function|null} fn
   */
  setOnModalBack(fn) {
    this._onModalBack = fn;
  },

  /**
   * Зарегистрировать cleanup-функцию, которая будет вызвана
   * автоматически при ЛЮБОМ уходе с текущего экрана
   * (кнопка Назад, goBack, backTo, goHome, navigate).
   * @param {Function} fn
   */
  setOnLeave(fn) {
    this._onLeave = fn;
  },

  /**
   * Внутренний метод: выполнить cleanup текущего экрана и сбросить.
   */
  _runLeaveCleanup() {
    const fn = this._onLeave;
    this._onLeave = null;
    if (fn) {
      try { fn(); } catch (e) { console.error("onLeave cleanup error:", e); }
    }
  },

  /**
   * Сохранить re-render функцию для текущего экрана.
   */
  saveCurrentRender(renderFn) {
    this._currentRender = renderFn;
  },

  /**
   * Перейти на новый экран.
   * @param {string} screenId — идентификатор экрана
   * @param {Function} renderFn — функция отрисовки экрана
   * @param {object} [options]
   * @param {boolean} [options.replace] — заменить текущий экран в истории (для prev/next level)
   */
  navigate(screenId, renderFn, options = {}) {
    if (!this.root) return;

    // Cleanup текущего экрана перед уходом
    this._runLeaveCleanup();

    if (options.replace && this.history.length > 0) {
      // Заменяем запись предыдущего экрана (prev/next level)
      this.history[this.history.length - 1] = {
        id: this.currentScreen,
        render: this._currentRender
      };
    } else if (this.currentScreen) {
      // Сохраняем текущий экран в историю
      this.history.push({
        id: this.currentScreen,
        render: this._currentRender
      });
    }

    this.previousScreen = this.currentScreen;
    this.currentScreen = screenId;
    this._currentRender = null; // сбрасываем, новый экран сохранит свою

    // Push state для браузерной кнопки «Назад»
    if (!options.replace) {
      history.pushState({ screen: screenId }, "", "");
    }

    renderFn();
  },

  /**
   * Вернуться на предыдущий экран.
   * Если истории нет — вернуться в главное меню.
   */
  goBack() {
    if (this.modalOpen) {
      this.closeModal();
      return;
    }

    // Закрыть свёрнутый оверлей (победа/импичмент), если он есть
    const reopenBtn = document.querySelector(".result-reopen-btn");
    if (reopenBtn && reopenBtn.style.display !== "none") {
      const overlay = reopenBtn.closest("#win-screen, #impeachment-screen");
      if (overlay) {
        overlay.style.display = "";
        reopenBtn.style.display = "none";
        this.closeModal();
        return;
      }
    }

    if (this.history.length > 0) {
      // Cleanup текущего экрана перед уходом
      this._runLeaveCleanup();

      const prev = this.history.pop();
      this.previousScreen = this.currentScreen;
      this.currentScreen = prev.id;

      if (prev.render) {
        prev.render();
      }
    } else if (this.currentScreen !== "intro") {
      // Истории нет и мы не в главном меню — вернуться в главное меню
      this.goHome();
    }
    // Если мы уже в главном меню — ничего не делаем
  },

  /**
   * Вернуться к определённому экрану в истории,
   * удалив все экраны после него.
   * @param {string} screenId — идентификатор экрана
   */
  backTo(screenId) {
    // Ищем экран в истории сверху вниз
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].id === screenId) {
        // Cleanup текущего экрана перед уходом
        this._runLeaveCleanup();

        // Нашли — восстанавливаем его, удаляя всё после
        const entry = this.history[i];
        this.history.length = i; // обрезаем историю до этого entry (не включая)
        this.previousScreen = this.currentScreen;
        this.currentScreen = entry.id;
        if (entry.render) {
          entry.render();
        }
        return;
      }
    }
    // Не нашли — идём в главное меню
    this.goHome();
  },

  /**
   * Вернуться в главное меню (introScreen).
   */
  goHome() {
    // Cleanup текущего экрана перед уходом
    this._runLeaveCleanup();

    this.clearHistory();
    this.navigate("intro", () => {
      import("../screens/introScreen.js").then(m => m.showIntroScreen(this.root));
    });
  },

  /**
   * Можно ли вернуться назад.
   */
  canGoBack() {
    return this.history.length > 0;
  },

  /**
   * Очистить историю экранов.
   */
  clearHistory() {
    this.history = [];
    this.previousScreen = null;
  },

  /**
   * Пометить что открыто модальное окно (win/impeachment overlay).
   */
  openModal() {
    this.modalOpen = true;
  },

  /**
   * Пометить что модальное окно закрыто.
   */
  closeModal() {
    this.modalOpen = false;
    this._onModalBack = null;
  },

};

export default NavigationService;
