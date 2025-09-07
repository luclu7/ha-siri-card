class SiriNextDepartureCard extends HTMLElement {
  set hass(hass) {
    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <div class="card-header"></div>
          <div class="card-content">
            <div class="departure-list"></div>
          </div>
        </ha-card>
      `;
      this.content = this.querySelector("div.card-content");
      this.header = this.querySelector("div.card-header");
      this.departureList = this.querySelector("div.departure-list");

      const style = document.createElement("style");
      style.textContent = `
        .departure-list {
          width: 100%;
          border-spacing: 0;
        }
        .departure-item {
          display: flex;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.12));
        }
        .departure-item:last-child {
          border-bottom: none;
        }
        .departure-time {
          font-size: 1.2em;
          font-weight: bold;
          margin-right: 16px;
          min-width: 55px;
        }
        .departure-eta {
          font-size: 0.9em;
          color: var(--secondary-text-color);
          margin-left: auto;
          padding-left: 8px;
        }
        .departure-line {
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 4px;
          margin-right: 8px;
          color: white;
          background-color: var(--primary-color);
          min-width: 30px;
          text-align: center;
        }
        .departure-destination {
          flex-grow: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .icon-container {
          margin-right: 8px;
        }
        .no-departures {
          color: var(--secondary-text-color);
          font-style: italic;
          padding: 16px 0;
          text-align: center;
        }
      `;
      this.appendChild(style);
    }

    const config = this._config;
    const entityId = config.entity;
    const entity = hass.states[entityId];

    if (!entity) {
      this.header.textContent = `Entité non trouvée: ${entityId}`;
      this.departureList.innerHTML = "";
      return;
    }

    const stopName = config.name ||
      entity.attributes.stop_name || entity.attributes.friendly_name;
    this.header.textContent = stopName;

    const departures = entity.attributes.departures || [];

    if (departures.length === 0) {
      this.departureList.innerHTML =
        '<div class="no-departures">Aucun départ prévu</div>';
      return;
    }

    this.departureList.innerHTML = "";

    const limit = config.max_departures || departures.length;
    const departuresLimited = departures.slice(0, limit);

    departuresLimited.forEach((departure) => {
      const departureItem = document.createElement("div");
      departureItem.className = "departure-item";

      const departureTime = new Date(departure.expected_departure_time);
      const aimedDepartureTime = new Date(departure.aimed_departure_time);
      const delay = departureTime - aimedDepartureTime;
      const delayMinutes = Math.round(delay / 60000);
      const delaySign = delayMinutes > 0 ? "+" : "";

      const now = new Date();
      const waitMinutes = Math.round((departureTime - now) / 60000);
      const formattedTime = departureTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      let icon = "mdi:bus";
      const transportMode = (departure.line_transport_mode || departure.vehicle_mode || "").toLowerCase();
      if (transportMode.includes("tram")) {
        icon = "mdi:tram";
      } else if (
        transportMode.includes("rail") ||
        transportMode.includes("train")
      ) {
        icon = "mdi:train";
      } else if (
        transportMode.includes("metro") ||
        transportMode.includes("subway")
      ) {
        icon = "mdi:subway";
      } else if (
        transportMode.includes("ferry") ||
        transportMode.includes("boat")
      ) {
        icon = "mdi:ferry";
      }

      departureItem.innerHTML = `
        <div class="icon-container">
          <ha-icon icon="${icon}"></ha-icon>
        </div>
        <div class="departure-time">${formattedTime} ${
        this._show_delay ? `(${delaySign}${delayMinutes})` : ''
      }</div>
        <div class="departure-line" style="${
          departure.line_color ? `background-color: ${departure.line_color};` : ''
        }${
          departure.line_text_color ? `color: ${departure.line_text_color};` : ''
        }">${
        departure.line_public_code || departure.published_line_name || departure.line_ref || "-"
      }</div>
        <div class="departure-destination">${
          departure.destination_name || "Inconnu"
        }</div>
        <div class="departure-eta">${
          waitMinutes > 0 ? `${waitMinutes} min` : "À l'arrêt"
        }</div>
      `;

      this.departureList.appendChild(departureItem);
    });
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Vous devez définir une entité");
    }
    this._config = config;
    this._show_delay = config.show_delay || false;
  }

  getCardSize() {
    const limit = this._config?.max_departures || 5;
    return 1 + Math.min(limit, 7);
  }

  static getConfigElement() {
    return document.createElement("siri-next-departure-card-editor");
  }

  static getStubConfig() {
    return {
      entity: "sensor.siri_next_departure_card",
      max_departures: 5,
      show_delay: false,
    };
  }
}

class SiriNextDepartureCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  render() {
    if (!this._config || !this._hass) return;

    this.innerHTML = `
      <style>
        .form {
          display: flex;
          flex-direction: column;
        }
        .row {
          display: flex;
          align-items: center;
          margin: 5px 0;
        }
        .label {
          width: 130px;
          font-weight: 500;
        }
        ha-entity-picker, ha-textfield {
          flex: 1;
        }
      </style>
      <div class="form">
        <div class="row">
          <label class="label">Entité :</label>
          <ha-entity-picker
            .hass="${this._hass}"
            .value="${this._config.entity || ''}"
            .configValue="${'entity'}"
            include-domains="sensor"
            allow-custom-entity
          ></ha-entity-picker>
        </div>
        <div class="row">
          <label class="label">Nom :</label>
          <ha-textfield
            .value="${this._config.name || ''}"
            .configValue="${'name'}"
            placeholder="Nom personnalisé"
          ></ha-textfield>
        </div>
        <div class="row">
          <label class="label">Max départs :</label>
          <ha-textfield
            .value="${this._config.max_departures || 5}"
            .configValue="${'max_departures'}"
            type="number"
            min="1"
            max="10"
          ></ha-textfield>
        </div>
        <div class="row">
          <label class="label">Afficher délai :</label>
          <ha-switch
            .checked="${this._config.show_delay || false}"
            .configValue="${'show_delay'}"
          ></ha-switch>
        </div>
      </div>
    `;

    this.querySelectorAll('[configValue]').forEach((el) => {
      el.addEventListener('change', (ev) => this._valueChanged(ev));
      el.addEventListener('input', (ev) => this._valueChanged(ev));
    });
  }

  _valueChanged(ev) {
    if (!this._config) return;
    const target = ev.target;
    const value =
      target.type === 'checkbox' || target.tagName === 'HA-SWITCH'
        ? target.checked
        : target.value;

    const configValue = target.getAttribute("configValue");
    if (configValue) {
      this._config = {
        ...this._config,
        [configValue]: value,
      };
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: this._config },
        })
      );
    }
  }
}

customElements.define("siri-next-departure-card", SiriNextDepartureCard);
customElements.define("siri-next-departure-card-editor", SiriNextDepartureCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "siri-next-departure-card",
  name: "Carte des prochains départs SIRI",
  description: "Affiche les prochains départs d’un capteur SIRI",
});

