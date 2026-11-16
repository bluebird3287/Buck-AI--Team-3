import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users, ExternalLink, ChevronDown, ChevronUp, Info, Mail, Globe, Instagram, Calendar, UserPlus } from 'lucide-react';
import { ORG_DIRECTORY_URL, StudentOrg, StudentOrgData, officialListingUrl, searchOrgs } from '../lib/studentOrgs';

// The directory (~2 MB, 1,500+ orgs) is its own chunk, loaded the first time this tab opens.
let orgLoad: Promise<StudentOrgData> | null = null;
const loadOrgs = () => (orgLoad ??= import('../data/studentOrgs.json').then((m) => m.default as unknown as StudentOrgData));

const PAGE_SIZE = 25;
const selectClass =
  'px-3 py-2 rounded-xl border border-neutral-300 text-sm bg-white focus:outline-none focus:border-[#ba0c2f] min-w-0';
const linkClass =
  'px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 hover:border-[#ba0c2f] flex items-center gap-1';

const AUDIENCES = ['Undergraduate', 'Graduate', 'Professional'];

const Logo: React.FC<{ org: StudentOrg }> = ({ org }) => {
  const [failed, setFailed] = useState(false);
  const initials = org.name
    .split(/\s+/)
    .filter((w) => /^[A-Z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  if (!org.logo || failed)
    return (
      <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 text-[#ba0c2f] font-bold text-sm flex items-center justify-center shrink-0">
        {initials || <Users className="w-5 h-5" />}
      </div>
    );
  return (
    <img
      src={org.logo}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-12 h-12 rounded-xl object-contain bg-white border border-neutral-200 shrink-0"
    />
  );
};

const Detail: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">{label}</div>
    <div className="text-xs text-neutral-800 leading-relaxed whitespace-pre-line">{children}</div>
  </div>
);

const OrgCard: React.FC<{ org: StudentOrg; expanded: boolean; onToggle: () => void }> = ({ org, expanded, onToggle }) => {
  const blurb = org.description || org.purpose;
  const socials = [
    org.website && { href: org.website, label: 'Website', icon: <Globe className="w-3 h-3" /> },
    org.instagram && { href: org.instagram, label: 'Instagram', icon: <Instagram className="w-3 h-3" /> },
    org.facebook && { href: org.facebook, label: 'Facebook', icon: <ExternalLink className="w-3 h-3" /> },
    org.twitter && { href: org.twitter, label: 'X / Twitter', icon: <ExternalLink className="w-3 h-3" /> },
    org.otherSocial && { href: org.otherSocial, label: 'More', icon: <ExternalLink className="w-3 h-3" /> },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 p-4 space-y-3 shadow-2xs">
      <div className="flex items-start gap-3">
        <Logo org={org} />
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-sm text-neutral-900">{org.name}</h4>
          <div className="text-xs text-neutral-600">
            {[org.category || 'Uncategorized', org.audience, org.campus !== 'Columbus' && `${org.campus} campus`].filter(Boolean).join(' · ')}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {org.membershipType && (
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                  /open/i.test(org.membershipType)
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                {/open/i.test(org.membershipType) ? 'Open membership' : 'Application required'}
              </span>
            )}
            {org.dues !== null && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-100 text-neutral-700">
                {org.dues ? 'Dues' : 'No dues'}
              </span>
            )}
            {/pending/i.test(org.status) && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-100 text-neutral-500" title="Registration with the Ohio Union is pending">
                Registration pending
              </span>
            )}
          </div>
        </div>
      </div>

      {blurb && <p className={`text-xs text-neutral-700 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>{blurb}</p>}

      {org.meeting && (
        <div className="flex items-start gap-1.5 text-xs text-neutral-700">
          <Calendar className="w-3.5 h-3.5 shrink-0 mt-px text-neutral-500" />
          <span>Meets: {org.meeting}</span>
        </div>
      )}

      {expanded && (
        <div className="space-y-2.5 pt-1">
          {org.description && org.purpose && <Detail label="Purpose">{org.purpose}</Detail>}
          {org.howToJoin && <Detail label="How to join">{org.howToJoin}</Detail>}
          {org.joinWhen && <Detail label="When to join">{org.joinWhen}</Detail>}
          {org.categories.length > 1 && <Detail label="Categories">{org.categories.join(', ')}</Detail>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {org.email && (
          <a href={`mailto:${org.email}`} className={linkClass}>
            <Mail className="w-3 h-3" /> {org.email}
          </a>
        )}
        {socials.map((s) => (
          <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className={linkClass}>
            {s.icon} {s.label}
          </a>
        ))}
        <a
          href={officialListingUrl(org)}
          target="_blank"
          rel="noreferrer"
          title="Officer and advisor contacts are on the Ohio Union's listing"
          className={linkClass}
        >
          <UserPlus className="w-3 h-3" /> Official listing
        </a>
        {(org.howToJoin || org.joinWhen || (org.description && org.purpose) || org.categories.length > 1 || blurb.length > 220) && (
          <button onClick={onToggle} className="text-xs font-semibold text-[#ba0c2f] flex items-center gap-1 ml-auto">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Less' : 'How to join & more'}
          </button>
        )}
      </div>
    </div>
  );
};

export const StudentOrgsView: React.FC<{ initialQuery?: string }> = ({ initialQuery = '' }) => {
  const [data, setData] = useState<StudentOrgData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('All');
  const [campus, setCampus] = useState('Columbus');
  const [audience, setAudience] = useState('All');
  const [membership, setMembership] = useState<'any' | 'open' | 'application'>('any');
  const [noDues, setNoDues] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadOrgs()
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);
  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setExpandedId(null);
  }, [query, category, campus, audience, membership, noDues]);

  const orgs = data?.orgs ?? [];
  const categories = useMemo(() => [...new Set(orgs.flatMap((o) => o.categories))].sort(), [orgs]);
  const campuses = useMemo(() => [...new Set(orgs.map((o) => o.campus))].sort((a, b) => (a === 'Columbus' ? -1 : b === 'Columbus' ? 1 : a.localeCompare(b))), [orgs]);

  const results = useMemo(() => {
    const filtered = orgs.filter(
      (o) =>
        (campus === 'All' || o.campus === campus) &&
        (category === 'All' || o.categories.includes(category)) &&
        (audience === 'All' || o.audience === audience) &&
        (membership === 'any' || (membership === 'open' ? /open/i.test(o.membershipType) : /application/i.test(o.membershipType))) &&
        (!noDues || o.dues === false),
    );
    return searchOrgs(filtered, query);
  }, [orgs, query, category, campus, audience, membership, noDues]);

  const fetched = data ? new Date(`${data.fetchedAt}T12:00:00`).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#fcfcfb]">
      <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-2">
        <h3 className="text-base font-bold text-neutral-900">Student Organizations</h3>
        <p className="text-xs text-neutral-600">
          Every registered student organization at Ohio State{data ? ` (${data.count.toLocaleString()} across ${campuses.length} campuses)` : ''}: clubs,
          professional and honor societies, club sports, cultural, service, faith and Greek organizations. Search by interest, major, or name.
        </p>
        <div className="flex items-start gap-1.5 text-[11px] text-neutral-500">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>
            From the Ohio Union's{' '}
            <a href={ORG_DIRECTORY_URL} target="_blank" rel="noreferrer" className="underline hover:text-[#ba0c2f]">
              Find a Student Org
            </a>{' '}
            directory{fetched ? `, updated ${fetched}` : ''}. Officer and advisor contacts are on each org's official listing.
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clubs (e.g. consulting, investing, dance, pre-med, Alpha Kappa Psi)"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 text-sm bg-white focus:outline-none focus:border-[#ba0c2f]"
          />
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Campus" value={campus} onChange={(e) => setCampus(e.target.value)} className={selectClass}>
            <option value="All">All campuses</option>
            {campuses.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Who it's for" value={audience} onChange={(e) => setAudience(e.target.value)} className={selectClass}>
            <option value="All">Undergrad, grad &amp; professional</option>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            aria-label="Membership"
            value={membership}
            onChange={(e) => setMembership(e.target.value as typeof membership)}
            className={selectClass}
          >
            <option value="any">Any membership</option>
            <option value="open">Open membership</option>
            <option value="application">Application required</option>
          </select>
          <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700 px-1">
            <input type="checkbox" checked={noDues} onChange={(e) => setNoDues(e.target.checked)} />
            No dues
          </label>
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
          Couldn't load the organization directory. Refresh to try again, or browse the{' '}
          <a href={ORG_DIRECTORY_URL} target="_blank" rel="noreferrer" className="underline">Ohio Union's directory</a>.
        </div>
      )}
      {!data && !loadError && <div className="text-xs text-neutral-500">Loading student organizations…</div>}

      {data && (
        <div className="text-xs text-neutral-500">
          {results.length.toLocaleString()} organization{results.length === 1 ? '' : 's'}
          {query.trim() ? ', best matches first' : ''}
        </div>
      )}

      <div className="space-y-3">
        {results.slice(0, visibleCount).map((o) => (
          <OrgCard key={o.id} org={o} expanded={expandedId === o.id} onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)} />
        ))}
      </div>

      {data && results.length === 0 && (
        <div className="p-6 text-center text-sm text-neutral-600 bg-white rounded-2xl border border-neutral-200/90">
          No organizations match. Try fewer words or clear a filter.
        </div>
      )}
      {results.length > visibleCount && (
        <button
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          className="w-full py-2.5 rounded-xl border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 hover:border-[#ba0c2f]"
        >
          Show more ({(results.length - visibleCount).toLocaleString()} left)
        </button>
      )}
    </div>
  );
};
