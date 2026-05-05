const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const torgStyles = {
    h1: "font-family: Alaska; background-image: url('../../../systems/torgeternity/images/tab-header.webp'); background-repeat: no-repeat; background-size: 100% 100%; border: none; margin: 1rem 0px 0.7rem 0px; text-transform: uppercase; line-height: 30px; text-align: center; color: white; font-size: 1.25rem;",
    h2: "font-family: Alaska; text-align: center; font-size: 1.25rem; font-weight: bolder; text-shadow: #878787 1.5px 1.5px 0px, #878787 1.5px -1.5px 0px, #878787 -1.5px 1.5px 0px, #878787 -1.5px -1.5px 0px; text-transform: uppercase; color: #f7f3e8",
    hr: "background-image: url('../../../systems/torgeternity/images/separator.webp'); background-repeat: no-repeat; background-size: 100% 100%; border: none; height: 15px; margin: 10px 0px 10px 0px;"
  };

const JOURNAL_NAME = "Delphi Mission DSR Archives";

export class DSRTerminalApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.formData = {};
    this.archiveEntries = null;
  }

  static DEFAULT_OPTIONS = {
    id: "torg-eternity-dsr-terminal",
    tag: "div",
    window: { title: "Delphi Terminal v0.5.0", resizable: true },
    position: { width: 720, height: 800 },
    actions: {
      broadcast: this._onBroadcast,
      archive: this._onArchive,
      restore: this._onRestore,
      sendFromArchive: this._onSendFromArchive
    },
    classes:  ['themed', 'theme-dark'],
    tabs: [
      { navSelector: '.tabs[data-group="primary"]', contentSelector: ".dsr-body", initial: "form" }
    ],
  };

  static PARTS = {
    tabs: { template: "templates/generic/tab-navigation.hbs" }, // Optional helper
    content: { template: "modules/torg-eternity-dsr-terminal/templates/app/dsr-terminal.hbs" }
  };

  async _prepareContext(options) {    
    await super._prepareContext(options);
    if(this.archiveEntries === null){
      this.archiveEntries = await this._getArchives()
    }
    return {
      steps: ['A', 'B', 'C', 'D'],
      skills: CONFIG.torgeternity.skills,
      attributes: CONFIG.torgeternity.attributeTypes,
      dnOptions: {
        "6": "Very Easy (6)",
        "8": "Easy (8)",
        "10": "Standard (10)",
        "12": "Challenging (12)",
        "14": "Hard (14)",
        "16": "Very Hard (16)",
        "18": "Legendary (18)",
        "20": "Near Impossible (20)"
      },
      formData: this.formData,
      tabs: {
        form : {id: 'form', label : 'Mission Editor', group: 'primary', cssClass: 'active', icon: 'fas fa-edit'},
        archives : {id: 'archives', label : 'Mission Archives', group: 'primary', icon: 'fas fa-archive'}
      },
      tabGroups: {
        primary: 'form'
      },
      archiveEntries: this.archiveEntries
    };
  }

  /* -- Actions -- */

  static async _onBroadcast() {
    const data = new foundry.applications.ux.FormDataExtended(this.element.querySelector("form")).object;
    await this.submitMission(data, false);
  }

  static async _onArchive() {
    const data = new foundry.applications.ux.FormDataExtended(this.element.querySelector("form")).object;
    await this.submitMission(data, true);
  }

  static async _onRestore(event, target) {
    const pageId = target.dataset.pageId
    const page = this.archiveEntries.find(e => e.id === pageId);
    if (!page) return; // error maybe?

    const restoredData = this._parseContentForRestoration(page.fullContent);
    this.formData = {
      ...restoredData,
      fromRestoration: 1
    }
    this.tabGroups.primary = "form";
    this.render();
    ui.notifications.info(`Restored: ${page.title}`);
  }

  static async _onSendFromArchive(_event, target){
    const pageId = target.dataset.pageId
    const page = this.archiveEntries.find(e => e.id === pageId)
    if(!page) return; // error maybe?
    await ChatMessage.create({ content: page.fullContent });
  }

/* -- Internal Logic -- */
  async submitMission(data, isArchiveOnly) {
    const html = await this._generateChatHtml(data);
    let journal = game.journal.getName(JOURNAL_NAME) || await JournalEntry.create({ name: JOURNAL_NAME });
    if (!isArchiveOnly) {
      await ChatMessage.create({ content: html });
    }
    if(!data.fromRestoration){   
      await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: `${data.dsrTitle || "Dramatic Skill Resolution"}`, type: "text", text: { content: html } }]);   
    }
    this.archiveEntries = null
    this.formData = {}
    this.render()
    ui.notifications.info("Mission Archived.");
  }

  async _generateChatHtml(formData) {
    const missionId = `${Math.random().toString(36).substring(2, 5).toUpperCase()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    const steps = ['a', 'b', 'c', 'd'].map(letter => {
      const s = letter.toUpperCase();
      return {
        id: letter,
        letter,
        enricher: this._generateCheckEnricher(
          formData[`step${s}Skill`], 
          formData[`step${s}Attribute`], 
          formData[`step${s}DN`], 
          formData[`step${s}Description`], 
          formData[`step${s}UnskillUse`]
        )
      };
    });

    const templateData = {
      title: formData.dsrTitle || "MISSION_ID_NOT_FOUND",
      missionId: missionId,
      description: this._applyTorgStyles(formData.dsrDescription),
      steps: steps,
      lde: (formData.lastDitchEffortDescription || formData.lastDitchEffortSkill) ? {
        text: formData.lastDitchEffortDescription,
        enricher: this._generateCheckEnricher(
          formData.lastDitchEffortSkill, 
          formData.lastDitchEffortAttribute, 
          formData.lastDitchEffortDN, 
          formData.lastDitchEffortTestDesc, 
          formData.lastDitchEffortUnskillUse
        )
      } : null
    };
    return await foundry.applications.handlebars.renderTemplate("modules/torg-eternity-dsr-terminal/templates/chatcard/dsr-chat-card.hbs", templateData);
  }

 _generateCheckEnricher = (skill, attribute, dn, description, unskillUse = false) => {
    if (!skill && !attribute) return "";
    let skillAttributePart = (skill && attribute) ? `${skill},${attribute}` : (skill || attribute);
    return `@Check[${skillAttributePart}${dn ? `|dn=${dn}` : ''}${unskillUse ? '|unskilledUse=true' : ''}]${description ? `{${description}}` : ''}`;
  };

  _applyTorgStyles = (htmlContent) => {
    const headingRegex = /<(h[1-4]|hr)>/gi;
    return htmlContent ? htmlContent.replace(headingRegex, (match, tagName) => {
      const style = torgStyles[tagName.toLowerCase()];
      return `<${tagName} style="${style}">`;
    }) : "";
  }

  _parseContentForRestoration(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const checkRegex = /@Check\[([^\]|]+)(?:\|dn=(\d+))?(?:\|unskilledUse=(true|false))?\](?:\{([^\}]+)\})?/;

    let data = {
        dsrTitle: doc.querySelector('h2')?.textContent.trim() || "",
        dsrDescription: doc.querySelector('.dsr-description')?.innerHTML.trim() || ""
    };

    ['a', 'b', 'c', 'd'].forEach(letter => {
        const stepDiv = doc.querySelector(`[data-step="${letter}"]`);
        const m = stepDiv?.textContent.match(checkRegex);
        const S = letter.toUpperCase();
        if (m) {
            const parts = m[1].split(',');
            const isPartSkill = Object.keys(CONFIG.torgeternity.skills).includes(parts[0])
            data[`step${S}Skill`] = isPartSkill ? parts[0] : "";
            data[`step${S}Attribute`] = !isPartSkill ? parts[0] : parts[1] ? parts[1] : '';
            data[`step${S}DN`] = m[2] || "10";
            data[`step${S}UnskillUse`] = m[3] === "true";
            data[`step${S}Description`] = m[4] ?? "";
        }
    });

    const ldeDiv = doc.querySelector('[data-step="lde"]');
    const ldeMatch = ldeDiv?.textContent.match(checkRegex);
    if (ldeMatch) {
        const ldeParts = ldeMatch[1].split(',');
        data.lastDitchEffortSkill = ldeParts[0] || "";
        data.lastDitchEffortAttribute = ldeParts[1] || "";
        data.lastDitchEffortDN = ldeMatch[2] || "10";
        data.lastDitchEffortUnskillUse = ldeMatch[3] === "true";
        data.lastDitchEffortTestDesc = ldeMatch[4] || "";
        data.lastDitchEffortDescription = ldeDiv.querySelector('p')?.textContent.trim() || "";
    }
    return data;
  }

  async _getArchives() {
    const journal = await game.journal.getName(JOURNAL_NAME);
    if (!journal) return [];

    const checkRegex = /@Check\[([^\]|]+)(?:\|dn=(\d+))?(?:\|unskilledUse=(true|false))?\](?:\{([^\}]+)\})?/;
    return journal.pages.contents.slice().reverse().map(page => {
      const content = page.text.content;
      const doc = new DOMParser().parseFromString(content, "text/html");        
      const title = doc.querySelector('h2')?.textContent.trim() || page.name;
      const dsrDescription = doc.querySelector('.dsr-description')?.textContent
      const steps = ['a', 'b', 'c', 'd'].map(letter => {
        const stepDiv = doc.querySelector(`[data-step="${letter}"]`);
        const stepContent = stepDiv?.textContent || "";
        const m = stepContent.match(checkRegex);
        if (!m) return { label: letter.toUpperCase(), summary: "BYPASSED", details: "" };
        return {
          label: letter.toUpperCase(),
          summary: `${m[1]} | (DN:${m[2] || 10}) | Unskill: ${m[3] === 'true' ? '✅' : '❌'}`,
          details: m[4] || ""
        };
      });

      const ldeDiv = doc.querySelector('[data-step="lde"]');
      const ldeText = doc.querySelector('[data-step="lde"]>p')?.textContent
      const ldeMatch = ldeDiv?.textContent.match(checkRegex);
      const lde = ldeMatch ? {
          summary: `${ldeMatch[1]} | (DN:${ldeMatch[2] || 10})`,
          details: ldeMatch[4] || "",
          description: ldeText
      } : null;

      return {
        id: page.id,
        title,
        steps,
        lde,
        description: dsrDescription,
        fullContent: content 
      };
    });
  }
}