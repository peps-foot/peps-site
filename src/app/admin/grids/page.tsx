// src/app/admin/grids/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase }             from '@/lib/supabaseClient';

type MatchRow = {
  id: string;
  date: string;
  home_team: string;
  away_team: string;
  competition: string;
};

type GridRow = {
  id: string;
  title: string;
  description: string | null;
};

export default function AdminGridsPage() {
  // onglet + états
  const [tab, setTab]                     = useState<'create'|'list'>('create');
  const [loading, setLoading]             = useState(false);
  const [message, setMessage]             = useState<string|null>(null);
  const [editingGridId, setEditingGridId] = useState<string|null>(null);

  // ── États pour “Créer / Modifier” ─────────────────
  const [comps, setComps]                     = useState<string[]>([]);
  const [matches, setMatches]                 = useState<MatchRow[]>([]);
  const [selComp, setSelComp]                 = useState('');
  const [startDate, setStartDate]             = useState('');
  const [endDate, setEndDate]                 = useState('');
  const [selectedMatches, setSelectedMatches] = useState<MatchRow[]>([]);
  const [title, setTitle]                     = useState('');
  const [description, setDescription]         = useState('');

  useEffect(() => {
    // charger les compétitions disponibles
    supabase
      .from('matches')
      .select('competition')
      .then(({ data }) => {
        if (data) setComps(Array.from(new Set(data.map(m => m.competition))));
      });
  }, []);

  // recherche des matchs selon filtres
  const handleSearch = async () => {
    setMessage(null);
    const q = supabase
      .from('matches')
      .select('id,date,home_team,away_team,competition')
      .order('date',{ ascending: true });
    if (selComp)   q.eq('competition', selComp);
    if (startDate) q.gte('date', startDate);
    if (endDate)   q.lte('date', endDate);

    const { data, error } = await q;
    if (error) setMessage(error.message);
    else setMatches(data as MatchRow[]);
  };

  // sélectionner / retirer un match
  const selectMatch = (m: MatchRow) => {
    setSelectedMatches(prev =>
      prev.find(x => x.id === m.id) ? prev : [...prev, m]
    );
  };
  const removeMatch = (id: string) => {
    setSelectedMatches(prev => prev.filter(x => x.id !== id));
  };

  // ── handleSave : CREATE ou UPDATE puis liaisons ───────
  const handleSave = async () => {
    if (!title.trim() || selectedMatches.length === 0) {
      setMessage('Il faut un titre et au moins un match.');
      return;
    }
    setLoading(true);
    try {
      let gridId = editingGridId;

      if (gridId) {
        // --- MODE ÉDITION ---
        await supabase
          .from('grids')
          .update({ title: title.trim(), description })
          .eq('id', gridId);

        // 1) supprimer toutes les liaisons existantes
        await supabase
          .from('grid_items')
          .delete()
          .eq('grid_id', gridId);
      } else {
        // --- MODE CRÉATION ---
        const { data: g, error: ge } = await supabase
          .from('grids')
          .insert([{
            user_id:    (await supabase.auth.getSession()).data.session!.user.id,
            title:      title.trim(),
            description
          }])
          .select('id')
          .single();
        if (ge || !g) throw ge || new Error('Erreur création');
        gridId = g.id;
      }

      // 2) réinsérer uniquement les liaisons actuelles
      const toInsert = selectedMatches.map(m => ({
        grid_id:  gridId!,
        match_id: m.id
      }));
      const { error: liErr } = await supabase
        .from('grid_items')
        .insert(toInsert);
      if (liErr) throw liErr;

      setMessage(editingGridId ? 'Grille mise à jour !' : 'Grille créée !');
      // reset form
      setTitle(''); setDescription('');
      setMatches([]); setSelectedMatches([]);
      setEditingGridId(null);
      setTab('list');
    } catch (err: any) {
      console.error(err);
      setMessage('Erreur sauvegarde : ' + (err.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  };

  // ── États pour “Liste des grilles” ────────────────────
  const [grids, setGrids] = useState<GridRow[]>([]);
  const fetchGrids = async () => {
    const { data, error } = await supabase
      .from('grids')
      .select('id,title,description')
      .order('created_at',{ ascending: false });
    if (!error && data) setGrids(data);
  };
  useEffect(() => { if (tab==='list') fetchGrids(); }, [tab]);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette grille ?')) return;
    await supabase.from('grids').delete().eq('id', id);
    setGrids(gs => gs.filter(g => g.id !== id));
  };

  // pré-remplir en mode édition
  const handleEdit = async (id: string) => {
    setLoading(true);
    setMessage(null);
    setEditingGridId(id);

    // A) charger titre/description
    const { data: g, error: ge } = await supabase
      .from('grids')
      .select('title,description')
      .eq('id', id)
      .single();
    if (ge||!g) {
      setMessage('Impossible de charger la grille');
      setLoading(false);
      return;
    }
    setTitle(g.title);
    setDescription(g.description || '');

    // B) récupérer tous les match_id liés
    const { data: rows, error: ri } = await supabase
      .from('grid_items')
      .select('match_id')
      .eq('grid_id', id);
    const ids = rows?.map(r => r.match_id) || [];

    // C) charger les données de ces matchs
    const { data: ms, error: me } = await supabase
      .from('matches')
      .select('id,date,home_team,away_team,competition')
      .in('id', ids)
      .order('date',{ ascending:true });
    if (me||!ms) {
      setMessage('Impossible de charger les matchs');
      setLoading(false);
      return;
    }
    setMatches(ms as MatchRow[]);
    setSelectedMatches(ms as MatchRow[]);
    setTab('create');
    setLoading(false);
  };

  return (
    <div className="p-8 space-y-6">
      {/* onglets */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 -mb-px ${
            tab==='create' ? 'bg-white border rounded-t' : 'text-gray-600'
          }`}
          onClick={()=>setTab('create')}
        >
          Créer une grille
        </button>
        <button
          className={`px-4 py-2 -mb-px ml-2 ${
            tab==='list' ? 'bg-white border rounded-t' : 'text-gray-600'
          }`}
          onClick={()=>setTab('list')}
        >
          Liste des grilles
        </button>
      </div>

      {/* créer / modifier */}
      {tab==='create' && (
        <div className="space-y-4">
          {/* filtres */}
          <div className="flex items-center space-x-2">
            <select
              className="border p-1"
              value={selComp}
              onChange={e=>setSelComp(e.target.value)}
            >
              <option value="">Toutes compétitions</option>
              {comps.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="date"
              className="border p-1"
              value={startDate}
              onChange={e=>setStartDate(e.target.value)}
            />
            <input
              type="date"
              className="border p-1"
              value={endDate}
              onChange={e=>setEndDate(e.target.value)}
            />
            <button
              onClick={handleSearch}
              className="bg-purple-600 text-white px-3 py-1 rounded"
            >
              Valider
            </button>
          </div>

          {/* résultats */}
          <div className="max-h-64 overflow-auto border">
            {matches.map(m => (
              <div
                key={m.id}
                className="flex justify-between px-4 py-2 hover:bg-gray-50"
              >
                <div>
                  {new Date(m.date).toLocaleString()} — {m.home_team} vs {m.away_team}
                </div>
                <button
                  onClick={()=>selectMatch(m)}
                  disabled={selectedMatches.some(x=>x.id===m.id)}
                  className={`px-2 py-1 border rounded ${
                    selectedMatches.some(x=>x.id===m.id)
                      ? 'bg-gray-400 text-gray-700'
                      : 'bg-green-500 text-white'
                  }`}
                >
                  {selectedMatches.some(x=>x.id===m.id) ? '✓' : 'Select'}
                </button>
              </div>
            ))}
            {!matches.length && (
              <p className="p-4 text-gray-500">Aucun match à afficher</p>
            )}
          </div>

          {/* sélection */}
          <div>
            <h2 className="font-semibold">Matchs sélectionnés :</h2>
            <ul className="list-disc pl-6">
              {selectedMatches.map(m => (
                <li key={m.id} className="flex justify-between">
                  <span>
                    {new Date(m.date).toLocaleString()} — {m.home_team} vs {m.away_team}
                  </span>
                  <button
                    onClick={()=>removeMatch(m.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded"
                  >
                    delete
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* métadonnées */}
          <div className="space-y-2 max-w-md">
            <input
              type="text"
              placeholder="Nom de la grille"
              value={title}
              onChange={e=>setTitle(e.target.value)}
              className="w-full border p-2 rounded"
            />
            <textarea
              placeholder="Présentation"
              value={description}
              onChange={e=>setDescription(e.target.value)}
              className="w-full border p-2 rounded"
            />
          </div>

          {/* bouton sauver */}
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded"
          >
            {loading
              ? '…'
              : editingGridId
                ? 'Mettre à jour'
                : 'Valider la grille'}
          </button>
          {message && <p className="text-red-600">{message}</p>}
        </div>
      )}

      {/* liste */}
      {tab==='list' && (
        <div className="space-y-4">
          {!grids.length && <p>Aucune grille pour l’instant.</p>}
          {grids.map(g => (
            <div
              key={g.id}
              className="flex justify-between items-center p-4 border rounded hover:bg-gray-50"
            >
              <div>
                <strong>{g.title}</strong>
                {g.description && <p className="text-sm text-gray-600">{g.description}</p>}
              </div>
              <div className="space-x-2">
                <button
                  onClick={()=>handleEdit(g.id)}
                  className="px-2 py-1 bg-yellow-400 text-white rounded"
                >
                  Modifier
                </button>
                <button
                  onClick={()=>handleDelete(g.id)}
                  className="px-2 py-1 bg-red-500 text-white rounded"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
