import React, { useState } from 'react';
import { Link, Globe, Scissors, BarChart3, ChevronDown, ChevronRight, ArrowLeft, Check, Zap, ArrowRight } from 'lucide-react';

const FLOWS = {
  OVERVIEW: 'overview',
  SHORTEN: 'shorten',
  DOMAINS: 'domains',
  DNS: 'dns',
  ANALYTICS: 'analytics',
};

function TgBubble({ from, children, buttons, isBot = true }) {
  return (
    <div className={`tg-bubble ${isBot ? 'tg-bubble--bot' : 'tg-bubble--user'}`} data-testid="tg-bubble">
      {from && <span className="tg-bubble__from">{from}</span>}
      <div className="tg-bubble__body">{children}</div>
      {buttons && (
        <div className="tg-bubble__buttons">
          {buttons.map((row, ri) => (
            <div key={ri} className="tg-btn-row">
              {(Array.isArray(row) ? row : [row]).map((btn, bi) => (
                <span key={bi} className="tg-btn">{btn}</span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepBadge({ num, label, active }) {
  return (
    <div className={`step-badge ${active ? 'step-badge--active' : ''}`} data-testid={`step-${num}`}>
      <span className="step-badge__num">{num}</span>
      <span className="step-badge__label">{label}</span>
    </div>
  );
}

function Section({ icon: Icon, title, accent, children, id }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`flow-section flow-section--${accent || 'emerald'}`} id={id} data-testid={`section-${id}`}>
      <button className="flow-section__header" onClick={() => setOpen(!open)}>
        <div className="flow-section__title-group">
          {Icon && <Icon size={20} />}
          <h3>{title}</h3>
        </div>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>
      {open && <div className="flow-section__body">{children}</div>}
    </section>
  );
}

export default function URLShortenerDomainJourney() {
  const [activeFlow, setActiveFlow] = useState(FLOWS.OVERVIEW);

  if (activeFlow !== FLOWS.OVERVIEW) {
    return (
      <div className="journey-wrap" data-testid="url-shortener-journey">
        <button className="back-btn" onClick={() => setActiveFlow(FLOWS.OVERVIEW)} data-testid="back-to-overview">
          <ArrowLeft size={16} /> Back to Overview
        </button>
        {activeFlow === FLOWS.SHORTEN && <ShortenFlow />}
        {activeFlow === FLOWS.DOMAINS && <DomainsFlow />}
        {activeFlow === FLOWS.DNS && <DnsFlow />}
        {activeFlow === FLOWS.ANALYTICS && <AnalyticsFlow />}
      </div>
    );
  }

  return (
    <div className="journey-wrap" data-testid="url-shortener-journey">
      <div className="journey-header">
        <h2 className="journey-title">URL Shortener & Domain Management</h2>
        <p className="journey-subtitle">Shorten links, register domains, manage DNS — all via Telegram</p>
      </div>

      <div className="journey-cards">
        <JourneyCard icon={Scissors} title="Shorten URLs" desc="Bit.ly or Shortit links with custom domains" accent="emerald" onClick={() => setActiveFlow(FLOWS.SHORTEN)} />
        <JourneyCard icon={Globe} title="Buy Domains" desc="Register .com, .sbs, .xyz and more" accent="sky" onClick={() => setActiveFlow(FLOWS.DOMAINS)} />
        <JourneyCard icon={Link} title="DNS Management" desc="Add, update, delete DNS records" accent="violet" onClick={() => setActiveFlow(FLOWS.DNS)} />
        <JourneyCard icon={BarChart3} title="Analytics" desc="Track clicks and short link performance" accent="amber" onClick={() => setActiveFlow(FLOWS.ANALYTICS)} />
      </div>
    </div>
  );
}

function JourneyCard({ icon: Icon, title, desc, accent, onClick }) {
  return (
    <div className={`feature-card feature-card--clickable feature-card--${accent}`} onClick={onClick} role="button" tabIndex={0} data-testid={`journey-card-${accent}`}>
      <div className="feature-icon"><Icon size={22} /></div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
      <span className="feature-card__arrow">View Journey <ArrowRight size={14} /></span>
    </div>
  );
}

function ShortenFlow() {
  return (
    <Section icon={Scissors} title="URL Shortening Flow" accent="emerald" id="shorten">
      <div className="steps-row">
        <StepBadge num={1} label="Choose" active />
        <StepBadge num={2} label="Enter URL" />
        <StepBadge num={3} label="Select Domain" />
        <StepBadge num={4} label="Get Link" />
      </div>
      <div className="tg-chat">
        <TgBubble from="User" isBot={false}>
          <p>Redirect & Shorten</p>
        </TgBubble>
        <TgBubble from="NomadlyBot" buttons={[['Random Short Link'], ['Back', 'Cancel']]}>
          <p>Kindly share the URL that you would like shortened and analyzed.</p>
        </TgBubble>
        <TgBubble from="User" isBot={false}>
          <p>https://example.com/my-long-url</p>
        </TgBubble>
        <TgBubble from="NomadlyBot" buttons={[['Bit.ly $10', 'Shortit (Trial 5)'], ['Back', 'Cancel']]}>
          <p>Choose link provider:</p>
        </TgBubble>
        <TgBubble from="NomadlyBot">
          <p><Check size={14} /> Your shortened URL is: <code>goog.link/aB3xZ</code></p>
        </TgBubble>
      </div>
    </Section>
  );
}

function DomainsFlow() {
  return (
    <Section icon={Globe} title="Domain Purchase Flow" accent="sky" id="domains">
      <div className="steps-row">
        <StepBadge num={1} label="Search" active />
        <StepBadge num={2} label="Price" />
        <StepBadge num={3} label="DNS Setup" />
        <StepBadge num={4} label="Pay" />
        <StepBadge num={5} label="Done" />
      </div>
      <div className="tg-chat">
        <TgBubble from="User" isBot={false}>
          <p>Buy Domain Names</p>
        </TgBubble>
        <TgBubble from="NomadlyBot">
          <p>Please share the domain name you wish to purchase, like "abcpay.com".</p>
        </TgBubble>
        <TgBubble from="User" isBot={false}>
          <p>mybusiness.com</p>
        </TgBubble>
        <TgBubble from="NomadlyBot" buttons={[['Standard DNS', 'Cloudflare DNS'], ['Custom DNS'], ['Back', 'Cancel']]}>
          <p>Select DNS provider for <b>mybusiness.com</b>:</p>
        </TgBubble>
        <TgBubble from="NomadlyBot" buttons={[['Crypto', 'Wallet'], ['Back', 'Cancel']]}>
          <p>Price of mybusiness.com is $12.50 USD. Choose payment method.</p>
        </TgBubble>
        <TgBubble from="NomadlyBot">
          <p><Zap size={14} /> Domain mybusiness.com is now yours. DNS propagation may take up to 30 minutes.</p>
        </TgBubble>
      </div>
    </Section>
  );
}

function DnsFlow() {
  return (
    <Section icon={Link} title="DNS Management Flow" accent="violet" id="dns">
      <div className="tg-chat">
        <TgBubble from="User" isBot={false}>
          <p>DNS Management</p>
        </TgBubble>
        <TgBubble from="NomadlyBot" buttons={[['mybusiness.com'], ['example.xyz'], ['Buy Domain Name'], ['Back', 'Cancel']]}>
          <p>Please select a domain to manage DNS settings.</p>
        </TgBubble>
        <TgBubble from="NomadlyBot" buttons={[['Add DNS Record'], ['Update DNS Record'], ['Delete DNS Record'], ['Activate for URL Shortener'], ['Back', 'Cancel']]}>
          <p>DNS Records for <b>mybusiness.com</b>:</p>
          <p>1. A — 216.24.57.1</p>
          <p>2. CNAME — www → mybusiness.com</p>
        </TgBubble>
      </div>
    </Section>
  );
}

function AnalyticsFlow() {
  return (
    <Section icon={BarChart3} title="Short Link Analytics" accent="amber" id="analytics">
      <div className="tg-chat">
        <TgBubble from="User" isBot={false}>
          <p>View Shortlink Analytics</p>
        </TgBubble>
        <TgBubble from="NomadlyBot">
          <p><b>Short Link Analytics</b></p>
          <p>Total Links: <b>12</b></p>
          <p>Total Clicks: <b>1,847</b></p>
          <p>Most Popular: goog.link/aB3xZ (523 clicks)</p>
        </TgBubble>
      </div>
    </Section>
  );
}
