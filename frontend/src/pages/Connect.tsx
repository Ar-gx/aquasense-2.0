import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../services/api";
import { useFarm } from "../context/FarmContext";
import type { Organization } from "../lib/types";
import PageHeader from "../components/ui/PageHeader";
import { Card, EmptyFarm, Note, Skeleton, SourceChip, TINT } from "../components/ui/primitives";

const SERVICES = [
  "Soil health", "Soil testing guidance", "Nutrient management",
  "Water conservation", "Rainwater harvesting", "Groundwater awareness",
  "Efficient irrigation", "Sustainable farming", "Watershed development",
];

export default function Connect() {
  const { dashboard, loadDemo } = useFarm();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [searchLink, setSearchLink] = useState("");
  const [note, setNote] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getOrganizations(stateFilter || undefined)
      .then((r) => {
        setOrgs(r.organizations);
        setSearchLink(r.search_link);
        setNote(r.note);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [stateFilter]);

  const states = useMemo(() => {
    const set = new Set<string>();
    orgs.forEach((o) => (o.states ?? []).forEach((s) => set.add(s)));
    return [...set].sort();
  }, [orgs]);

  const visible = serviceFilter
    ? orgs.filter((o) => o.services.includes(serviceFilter))
    : orgs;

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <ConnectHeader
          stateFilter={stateFilter} setStateFilter={setStateFilter}
          states={states} serviceFilter={serviceFilter}
          setServiceFilter={setServiceFilter}
        />
        <Note tone="info">
          You can browse organizations without a farm — load the Demo Farm or
          analyze your own to also get soil/irrigation guidance matched to your
          conditions.
        </Note>
        {loading ? <Skeleton className="h-80 w-full" /> : <OrgGrid orgs={visible}
                                                                  searchLink={searchLink}
                                                                  note={note} />}
        <EmptyFarm action={
          <button onClick={() => loadDemo().catch(() => undefined)}
                  className="btn-primary">▶ Try Demo Farm</button>
        } />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ConnectHeader
        stateFilter={stateFilter} setStateFilter={setStateFilter}
        states={states} serviceFilter={serviceFilter}
        setServiceFilter={setServiceFilter}
      />

      {/* services filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-mist/70">
          Filter by service:
        </span>
        <button
          onClick={() => setServiceFilter("")}
          className={`chip !normal-case ${!serviceFilter ? "src-live" : "src-rule"}`}>
          All
        </button>
        {SERVICES.map((s) => (
          <button
            key={s}
            onClick={() => setServiceFilter(serviceFilter === s ? "" : s)}
            className={`chip !normal-case ${serviceFilter === s ? "src-live" : "src-rule"}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <OrgGrid orgs={visible} searchLink={searchLink} note={note} />
      )}

      {/* education */}
      <Card accent="leaf" className="!p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="card-title">Education & self-service</span>
          <SourceChip source="live_api" label="external links" />
        </div>
        <div className="grid gap-2.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <Edu title="Soil Health Card Scheme (Govt. of India)"
               body="Free soil testing + nutrient recommendations via your district
                     agriculture office."
               link="https://www.soilhealth.dac.gov.in" />
          <Edu title="KVK search (ICAR)"
               body="Krishi Vigyan Kendras give free crop & irrigation advice
                     district-wise."
               link="https://kvk.icar.gov.in" />
          <Edu title="IMD weather (Govt. of India)"
               body="Official forecasts and advisories — cross-check AquaSense
                     forecasts anytime."
               link="https://mausam.imd.gov.in" />
          <Edu title="FAO Irrigation Drainage Paper 56"
               body="The reference methodology behind every Kc, ETo and depletion
                     number here."
               link="https://www.fao.org/4/X0490E/x0490e00.htm" />
          <Edu title="Drip/sprinkler subsidy info (agri ministries)"
               body="Most states subsidise efficient irrigation — ask your taluk
                     agriculture officer for current rates."
               link="https://agriwelfare.gov.in" />
          <Edu title="OpenWeather (weather API docs)"
               body="Transparency: the exact APIs this app calls are public and
                     documented."
               link="https://openweathermap.org/api" />
        </div>
      </Card>

      <Note tone="warn">
        {note || "Verified organizations with official websites only."} AquaSense
        does not partner with, endorse or receive referrals from any listed
        organization — verify everything on the official site before acting.
      </Note>

      <div className="flex flex-wrap gap-3">
        <Link to="/soil-health" className="btn-primary">Soil health →</Link>
        <Link to="/water-analytics" className="btn-ghost">Water analytics</Link>
        <Link to="/achievements" className="btn-ghost">Achievements</Link>
      </div>
    </div>
  );
}

function ConnectHeader({ stateFilter, setStateFilter, states, serviceFilter,
                         setServiceFilter }: {
  stateFilter: string; setStateFilter: (s: string) => void;
  states: string[]; serviceFilter: string;
  setServiceFilter: (s: string) => void;
}) {
  return (
    <PageHeader
      eyebrow="Solution 07 · NGO Connections"
      title="Verified organizations & education"
      sub="Real organizations with official websites — no invented contacts,"
      actions={
        <>
          <select className="field !w-auto !py-1.5 text-xs"
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">All India</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </>
      }
    />
  );
}

function OrgGrid({ orgs, searchLink, note }: {
  orgs: Organization[]; searchLink: string; note: string;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orgs.map((o, i) => (
          <motion.a
            key={o.name}
            href={o.website ?? undefined}
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: (i % 6) * 0.05, duration: 0.45 }}
            className={`glass block p-5 transition hover:-translate-y-1
                        ${o.website ? "hover:border-leaf-400/50" : "cursor-default"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs uppercase tracking-wider text-mist/70">
                {o.org_type}
              </span>
              {o.verified && (
                <span className="chip src-live shrink-0">✓ verified</span>
              )}
            </div>
            <h3 className="mt-2 font-display text-sm font-semibold text-ink">
              {o.name}
            </h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mist/70">
              {o.note}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {o.services.map((s) => (
                <span key={s} className="chip src-rule !text-[9px] !normal-case">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-mist/70">
                {o.states?.length ? o.states.join(", ") : "Pan-India"}
              </span>
              {o.website ? (
                <span className="text-[11px] text-leaf-600">
                  Visit official site ↗
                </span>
              ) : (
                <span className="text-[11px] text-mist/65">
                  no website listed
                </span>
              )}
            </div>
            <div className="mt-2">
              <SourceChip source={o.source} label="reference dataset" />
            </div>
          </motion.a>
        ))}
      </div>
      {orgs.length === 0 && (
        <Note tone="info">
          No organizations matched this filter — try another state or clear the
          service filter.
        </Note>
      )}
      {searchLink && (
        <div className="glass p-4 text-center">
          <span className="text-xs text-mist/70">
            {note} Need more local options?{" "}
          </span>
          <a href={searchLink} target="_blank" rel="noreferrer"
             className="text-xs font-medium text-leaf-600 underline">
            Open a district search ↗
          </a>
        </div>
      )}
    </>
  );
}

function Edu({ title, body, link }: {
  title: string; body: string; link: string;
}) {
  return (
    <a href={link} target="_blank" rel="noreferrer"
       className={`rounded-xl border p-3.5 transition
                   hover:-translate-y-0.5 hover:border-leaf-400/50 ${TINT.leaf}`}>
      <div className="font-medium text-ink">{title} ↗</div>
      <p className="mt-1 text-[11px] leading-relaxed text-mist/70">{body}</p>
    </a>
  );
}
