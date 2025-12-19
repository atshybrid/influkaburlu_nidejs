"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/storage";

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  return fallback;
}

type BrandItem = {
  brandUlid: string;
  companyName?: string | null;
  name?: string | null;
};

type BrandsResponse = {
  items: BrandItem[];
};

type AdSummary = {
  id: number;
  ulid?: string;
  title?: string | null;
  status?: string | null;
  finalBudget?: number | null;
};

type AdsResponse = {
  brandUlid: string;
  items: AdSummary[];
};

type CommissionItem = {
  id: number;
  ulid?: string;
  amount: number;
  status: string;
  createdAt?: string;
  brandUlid?: string;
  adUlid?: string;
};

type CommissionsResponse = {
  items: CommissionItem[];
};

export default function DashboardPage() {
  const router = useRouter();

  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);

  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);

  const [selectedBrandUlid, setSelectedBrandUlid] = useState<string | null>(null);
  const [ads, setAds] = useState<AdSummary[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const selectedBrand = useMemo(
    () => brands.find((b) => b.brandUlid === selectedBrandUlid) || null,
    [brands, selectedBrandUlid]
  );

  useEffect(() => {
    const token = getAccessToken();
    if (!token) router.replace("/login");
  }, [router]);

  useEffect(() => {
    async function load() {
      setError(null);

      setBrandsLoading(true);
      setCommissionsLoading(true);
      try {
        const [brandsRes, commRes] = await Promise.all([
          apiFetch<BrandsResponse>("/api/pr/brands"),
          apiFetch<CommissionsResponse>("/api/pr/commissions"),
        ]);
        setBrands(brandsRes.items || []);
        setCommissions(commRes.items || []);

        if (!selectedBrandUlid && brandsRes.items?.length) {
          setSelectedBrandUlid(brandsRes.items[0].brandUlid);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearAccessToken();
          router.replace("/login");
          return;
        }
        setError(getErrorMessage(err, "Failed to load dashboard"));
      } finally {
        setBrandsLoading(false);
        setCommissionsLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadAds() {
      if (!selectedBrandUlid) return;
      setAds([]);
      setAdsLoading(true);
      setError(null);
      try {
        const res = await apiFetch<AdsResponse>(
          `/api/pr/brands/${encodeURIComponent(selectedBrandUlid)}/ads`
        );
        setAds(res.items || []);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load ads"));
      } finally {
        setAdsLoading(false);
      }
    }

    loadAds();
  }, [selectedBrandUlid]);

  function logout() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <main style={{ padding: 16, display: "grid", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>PR Dashboard</h1>
        <button onClick={logout}>Logout</button>
      </header>

      {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

      <section style={{ display: "grid", gap: 8 }}>
        <h2>My Brands</h2>
        {brandsLoading ? (
          <div>Loading brands…</div>
        ) : brands.length === 0 ? (
          <div>No brands assigned.</div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {brands.map((b) => {
              const label = b.companyName || b.name || b.brandUlid;
              const selected = b.brandUlid === selectedBrandUlid;
              return (
                <button
                  key={b.brandUlid}
                  onClick={() => setSelectedBrandUlid(b.brandUlid)}
                  style={{
                    fontWeight: selected ? 700 : 400,
                    textDecoration: selected ? "underline" : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h2>
          Ads{selectedBrand ? ` — ${selectedBrand.companyName || selectedBrand.name || selectedBrand.brandUlid}` : ""}
        </h2>
        {!selectedBrandUlid ? (
          <div>Select a brand to view ads.</div>
        ) : adsLoading ? (
          <div>Loading ads…</div>
        ) : ads.length === 0 ? (
          <div>No ads found for this brand.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>ID</th>
                <th style={{ textAlign: "left" }}>Title</th>
                <th style={{ textAlign: "left" }}>Status</th>
                <th style={{ textAlign: "left" }}>Final Budget</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((a) => (
                <tr key={a.ulid || String(a.id)}>
                  <td>{a.ulid || a.id}</td>
                  <td>{a.title || "—"}</td>
                  <td>{a.status || "—"}</td>
                  <td>{typeof a.finalBudget === "number" ? a.finalBudget : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h2>My Commissions</h2>
        {commissionsLoading ? (
          <div>Loading commissions…</div>
        ) : commissions.length === 0 ? (
          <div>No commissions yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>ULID/ID</th>
                <th style={{ textAlign: "left" }}>Amount</th>
                <th style={{ textAlign: "left" }}>Status</th>
                <th style={{ textAlign: "left" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.ulid || String(c.id)}>
                  <td>{c.ulid || c.id}</td>
                  <td>{c.amount}</td>
                  <td>{c.status}</td>
                  <td>{c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
