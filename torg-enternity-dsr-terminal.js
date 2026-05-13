import { DSRTerminalApp } from "./lib/TorgEternityDSRTerminal.js";
let hasPrerendered = false
const V13HTML = `<button type="checkbox" name="dsrTerminal" class="ui-control button" data-tooltip="DSR Terminal" data-tooltip-direction="LEFT">
  <i class="fa fa-terminal" inert=""></i>
</button>`

Hooks.once("init", async () => {
  const templatePaths = [
    "modules/torg-eternity-dsr-terminal/templates/app/dsr-terminal.hbs",
    "modules/torg-eternity-dsr-terminal/templates/app/dsr-form.hbs",
    "modules/torg-eternity-dsr-terminal/templates/app/dsr-archive.hbs",
    "modules/torg-eternity-dsr-terminal/templates/chatcard/dsr-chat-card.hbs",
  ];
  await loadTemplates(templatePaths);
  
  console.log("DSR Terminal | Templates Loaded and Partials Registered");
});

Hooks.once('preRenderTorgControlButtons', (app, context, options) => {
  const { buttons } = context 
  const dsrButton = {
    name: 'dsrTerminal',
    label: 'DSR Terminal',
    icon: 'fa fa-terminal',
    type: 'button',
    classes: 'ui-control'
  };
  buttons.unshift(dsrButton)
  hasPrerendered = true
});

Hooks.on('renderTorgControlButtons', (app, html) => {
    //v13 specific block since there is no preRenderApplicationV2 hook
    if(!hasPrerendered){
      const body = html.querySelector('div[data-application-part="body"]')
      const btnHTML = foundry.utils.parseHTML(V13HTML)
      body.append(btnHTML)
    }
    const btn = html.querySelector('button[name="dsrTerminal"]');
    if (!btn) return;
    btn.addEventListener('click', (event) => {
        console.log("DSR Terminal Triggered");
        const existing = Object.values(ui.windows).find(w => w instanceof DSRTerminalApp);
        if (existing) existing.render(true, { focus: true });
        else new DSRTerminalApp().render(true);
    });
});