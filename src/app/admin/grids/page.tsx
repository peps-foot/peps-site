'use client';
import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../../components/SupabaseProvider'
import AdminPushPanel from '../../../components/AdminPushPanel';
import AdminXpPanel from '../../../components/AdminXpPanel';
import AdminEliminationsPanel from '../../../components/AdminEliminationsPanel';
import AdminBoostPanel from '../../../components/AdminBoostPanel';
import AdminAttendancePanel from '../../../components/AdminAttendancePanel';

import {
  addGridToCompetition,
  removeGridFromCompetition,
  removeMatchFromGrid,
  deleteGridEverywhere,
  addTicketToCompetition,
  removeTicketFromCompetition,  
  removeMatchFromTicket,
  deleteTicketEverywhere
} from '../../../lib/adminGridActions';

type BonusDef = { 
  id: string;
  code: string;
  name: string
};
type Fixture = {
  id: number;
  league_name: string;
  date: string;
  home_team: string;
  away_team: string;
};
type Grid = {
  id: string;
  title: string;
  created_at: string;
  allowed_bonuses: string[] | null;
  is_private_template: boolean | null;
  competition_id: string | null;
  description?: string | null;
};
type CompetRow = {
  id: string;
  name: string;
  description: string | null;
  mode: 'CLASSIC' | 'TOURNOI' | null;
  kind: 'PUBLIC' | 'PRIVATE' | null;
  game_type: 'GRID' | 'TIERCE' | null;
  xp_enabled: boolean | null;
  created_at: string;
};
type TierceTicket = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  competition_id: string | null;
};

export default function AdminGridsPage() {
  const supabase = useSupabase()
  // --- Onglets CRUD ---
  const [tab, setTab] = useState<
    'create' | 'list' | 'compet' | 'competList' | 'push' | 'xp' | 'eliminations' | 'boosts' | 'tierceCreate' | 'tierceList' | 'attendance'
  >('create');

  // États pour création/édition compétition
  const [competName, setCompetName] = useState('');
  const [selCompetGrids, setSelCompetGrids] = useState<string[]>([]);
  const [editingCompetId, setEditingCompetId] = useState<string | null>(null);
  const [messageCompet, setMessageCompet] = useState<string | null>(null);
  const [competGameType, setCompetGameType] = useState<'GRID' | 'TIERCE'>('GRID');
  const [selCompetTickets, setSelCompetTickets] = useState<string[]>([]);
  const [competDescription, setCompetDescription] = useState('');
  const [competMode, setCompetMode] = useState<'CLASSIC' | 'TOURNOI'>('CLASSIC');
  const [competKind, setCompetKind] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [competXpEnabled, setCompetXpEnabled] = useState(false);
  const [competBonusCaps, setCompetBonusCaps] = useState<Record<string, string>>({});

  // Liste des compétitions
  const [comps, setComps] = useState<CompetRow[]>([]);
  const [loadingComps, setLoadingComps] = useState(true);

  // States liés aux grilles
  const [gridId, setGridId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [competitionFilter, setCompetitionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selectedFixtures, setSelectedFixtures] = useState<number[]>([]);
  const [initialFixtureIds, setInitialFixtureIds] = useState<number[]>([]);
  const [allowedBonuses, setAllowedBonuses] = useState<string[]>([]);
  const [allBonusesChecked, setAllBonusesChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [availableFixtures, setAvailableFixtures] = useState<Fixture[]>([]);

  // States liés aux ticktes
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketLeagueFilters, setTicketLeagueFilters] = useState<string[]>([]);
  const [ticketDateFrom, setTicketDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [ticketDateTo, setTicketDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [initialTicketFixtureIds, setInitialTicketFixtureIds] = useState<string[]>([]);
  const [ticketAvailableFixtures, setTicketAvailableFixtures] = useState<any[]>([]);
  const [ticketSelectedFixtures, setTicketSelectedFixtures] = useState<string[]>([]);
  const [tierceTickets, setTierceTickets] = useState<TierceTicket[]>([]);
  const [loadingTierceTickets, setLoadingTierceTickets] = useState(true);
  const [savingTicket, setSavingTicket] = useState(false);
  const [ticketMessage, setTicketMessage] = useState('');

  // Shared data
  const [competitions, setCompetitions] = useState<string[]>([]);
  const [bonusDefs, setBonusDefs] = useState<BonusDef[]>([]);

  // Liste des grilles
  const [grids, setGrids] = useState<Grid[]>([]);
  const [loadingGrids, setLoadingGrids] = useState(true);
  const [loadingDefs, setLoadingDefs] = useState(false);

  //Pour cocher/décocher tous les bonus
  // A -l'état des bonus
  const toggleAllBonuses = () => {
    if (allBonusesChecked) {
      setAllowedBonuses([]);
      setAllBonusesChecked(false);
    } else {
      setAllowedBonuses(bonusDefs.map(b => b.id));
      setAllBonusesChecked(true);
    }
  };
  // B - Mise à jour de la case "tout cocher"
  useEffect(() => {
    if (bonusDefs.length === 0) return;

    const allSelected = bonusDefs.every(b => allowedBonuses.includes(b.id));
    setAllBonusesChecked(allSelected);
  }, [allowedBonuses, bonusDefs]);

  // Initial load pour grilles et tickets
  useEffect(() => {
    (async () => {
      // Bonus defs : on charge tous les bonus
      const { data: defs, error: defsErr } = await supabase
        .from('bonus_definition')
        .select('id,code,name')
        .order('code', { ascending: true });

      if (defsErr) {
        console.warn('bonus_definition lookup:', defsErr.message);
        setBonusDefs([]);
      } else {
        setBonusDefs(defs || []);
      }

      setLoadingDefs(false);

      // Distinct competitions
      const { data: comps2 } = await supabase
        .from('matches')
        .select('league_name');

      if (comps2) {
        const unique = [...new Set(comps2.map(c => c.league_name))];
        setCompetitions(unique);
      }

      // Grids
      const { data: gs } = await supabase
        .from('grids')
        .select('id,title,description,created_at,allowed_bonuses,is_private_template,competition_id')
        .eq('is_private_template', false)
        .order('created_at', { ascending: false });
      setGrids(gs || []);
      setLoadingGrids(false);

      // Tickets TIERCE
      const { data: tt } = await supabase
        .from('tierce_tickets')
        .select('id,title,description,created_at,competition_id')
        .order('created_at', { ascending: false });
      setTierceTickets((tt || []) as TierceTicket[]);
      setLoadingTierceTickets(false);
    })();
  }, []);

  // Charger compétitions
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('id,name,description,mode,kind,game_type,xp_enabled,created_at')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setComps(data as CompetRow[]);
      }

      setLoadingComps(false);
    })();
  }, []);

  // Pour ajouter et supprimer matchs pour grilles
  const addFixture = (id: number) => setSelectedFixtures(prev => [...prev, id]);
  const removeFixture = (id: number) => setSelectedFixtures(prev => prev.filter(x => x !== id));

  // Pour ajouter et supprimer matchs pour tickets
  const addTierceFixture = (id: string) => {setTicketSelectedFixtures((prev) => prev.includes(id) ? prev : [...prev, id]);};
  const removeTierceFixture = (id: string) => {setTicketSelectedFixtures((prev) => prev.filter((x) => x !== id));};

  // Importer des matchs pour une grille
  const handleImport = async () => {
    if (!competitionFilter) return;

    const { data: all } = await supabase
      .from('matches')
      .select('id,league_name,date,home_team,away_team')
      .gte('date', dateFrom + 'T00:00:00Z')
      .lte('date', dateTo + 'T23:59:59Z');

    if (!all) return;

    const newMatches = all.filter(f => f.league_name === competitionFilter);

    // Ajouter les nouveaux au pool global si absents
    setFixtures(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const merged = [...prev];
      newMatches.forEach(m => {
        if (!existingIds.has(m.id)) merged.push(m);
      });
      return merged;
    });

    // Afficher uniquement les nouveaux à gauche
    setAvailableFixtures(newMatches);
  };

  // Pour éditer une grilles
  const startEdit = async (id: string) => {
    setTab('create');
    setMessage(null);
    setGridId(id);

    const { data: g } = await supabase
      .from('grids')
      .select('title,allowed_bonuses,description')
      .eq('id', id)
      .single();
    if (g) {
      setTitle(g.title);
      setAllowedBonuses(g.allowed_bonuses);
      setDescription(g.description || '');
    }

    const { data: items } = await supabase
      .from('grid_items')
      .select('match_id')
      .eq('grid_id', id);

    const mids = items?.map(it => it.match_id) || [];
    setSelectedFixtures(mids);
    setInitialFixtureIds(mids); // 👈 on garde la photo “avant édition”

    if (mids.length) {
      const { data: det } = await supabase.from('matches').select('*').in('id', mids);
      setFixtures(det || []);
    }
  };

  // Supprimer une grille de la base
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette grille partout ?')) return;
    await deleteGridEverywhere(id); // RPC côté SQL, ordre de suppression correct
    setGrids(gs => gs.filter(g => g.id !== id));
  };

  // Pour enregistrer une grille
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      let gid = gridId;

      // 1) Créer / mettre à jour la grille
      if (gridId) {
        const { error: updErr } = await supabase
          .from('grids')
          .update({ title, description, allowed_bonuses: allowedBonuses })
          .eq('id', gridId);
        if (updErr) throw new Error('grids.update: ' + updErr.message);
      } else {
        const { data: ins, error: insErr } = await supabase
          .from('grids')
          .insert([{ title, description, allowed_bonuses: allowedBonuses }])
          .select('id')
          .single();
        if (insErr) throw new Error('grids.insert: ' + insErr.message);
        gid = ins!.id;
        setGridId(gid);
      }

      // 2) Calculer diff entre “avant” et “après”
      const before = new Set(initialFixtureIds);
      const after  = new Set(selectedFixtures);

      const toAdd    = [...after].filter(mid => !before.has(mid));
      const toRemove = [...before].filter(mid => !after.has(mid));

      // 3) Ajouter les nouveaux match_id (insert direct sur grid_items)
      if (toAdd.length) {
        const rows = toAdd.map(mid => ({ grid_id: gid!, match_id: mid }));
        const { error: addErr } = await supabase.from('grid_items').insert(rows).select();
        if (addErr) throw new Error('grid_items.insert: ' + addErr.message);
      }

      // 4) Retirer proprement les anciens (RPC = nettoie items + matches + bonus)
      for (const mid of toRemove) {
        await removeMatchFromGrid(gid!, mid);
      }

      // 5) Feedback + refresh liste des grilles
      setMessage('✅ Grille enregistrée');
      setDescription('');

      const { data: gs2 } = await supabase
        .from('grids')
        .select('id,title,created_at,allowed_bonuses,is_private_template,competition_id,description')
        .order('created_at', { ascending: false });

      setGrids((gs2 || []) as Grid[]);

      // 6) Reset du formulaire
      setInitialFixtureIds(selectedFixtures); // snapshot = nouvel état validé
      setGridId(null);
      setTitle('');
      setCompetitionFilter('');
      setDateFrom(new Date().toISOString().slice(0, 10));
      setDateTo(new Date().toISOString().slice(0, 10));
      setFixtures([]);
      setSelectedFixtures([]);
      setAllowedBonuses([]);
      setTab('list');
    } catch (err: unknown) {
      console.error(err);
      setMessage('❌ Erreur : ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Création / modification compétition
  const handleCompetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessageCompet(null);

    try {
      let compId = editingCompetId;

      if (compId) {
        // 1) Mise à jour nom + game_type
        const { error: updErr } = await supabase
          .from('competitions')
          .update({
            name: competName,
            description: competDescription,
            mode: competMode,
            kind: competKind,
            game_type: competGameType,
            xp_enabled: competXpEnabled,
          })
          .eq('id', compId);

        if (updErr) throw new Error('competitions.update: ' + updErr.message);

        if (competGameType === 'GRID') {
          // Lire les grilles liées
          const { data: existingLinks, error: readErr } = await supabase
            .from('competition_grids')
            .select('grid_id')
            .eq('competition_id', compId);
          if (readErr) throw new Error('competition_grids.select: ' + readErr.message);

          const existing = new Set((existingLinks ?? []).map(r => r.grid_id));
          const selected = new Set(selCompetGrids);

          const toAdd = [...selected].filter(gid => !existing.has(gid));
          const toRemove = [...existing].filter(gid => !selected.has(gid));

          for (const gid of toAdd) {
            await addGridToCompetition(compId!, gid);

            const { error: gridUpdErr } = await supabase
              .from('grids')
              .update({ competition_id: compId })
              .eq('id', gid);

            if (gridUpdErr) throw new Error('grids.update competition_id: ' + gridUpdErr.message);
          }

          for (const gid of toRemove) {
            await removeGridFromCompetition(compId!, gid);
          }
        }

        if (competGameType === 'TIERCE') {
          const { data: existingLinks, error: readErr } = await supabase
            .from('competition_tickets')
            .select('ticket_id')
            .eq('competition_id', compId);

          if (readErr) throw new Error('competition_tickets.select: ' + readErr.message);

          const existing = new Set((existingLinks ?? []).map(r => r.ticket_id));
          const selected = new Set(selCompetTickets);

          const toAdd = [...selected].filter(tid => !existing.has(tid));
          const toRemove = [...existing].filter(tid => !selected.has(tid));

          for (const tid of toAdd) {
            await addTicketToCompetition(compId!, tid);
          }

          for (const tid of toRemove) {
            await removeTicketFromCompetition(compId!, tid);
          }
        }
      } else {
        // Création compétition
        const { data: comp, error: compErr } = await supabase
          .from('competitions')
          .insert([{
            name: competName,
            description: competDescription,
            mode: competMode,
            kind: competKind,
            game_type: competGameType,
            xp_enabled: competXpEnabled,
          }])
          .select('id,name,description,mode,kind,game_type,xp_enabled,created_at')
          .single();

        if (compErr) throw new Error('competitions.insert: ' + compErr.message);

        compId = comp.id;

        setComps(cs => [
          {
            id: comp.id,
            name: comp.name,
            description: comp.description,
            mode: comp.mode,
            kind: comp.kind,
            game_type: comp.game_type,
            xp_enabled: comp.xp_enabled,
            created_at: comp.created_at,
          },
          ...cs
        ]);

        if (!compId) {
          setMessage("❌ Compétition introuvable");
          return;
        }

        if (competGameType === 'GRID' && selCompetGrids.length) {
          for (const gid of selCompetGrids) {
            await addGridToCompetition(compId, gid);

            const { error: gridUpdErr } = await supabase
              .from('grids')
              .update({ competition_id: compId })
              .eq('id', gid);

            if (gridUpdErr) throw new Error('grids.update competition_id: ' + gridUpdErr.message);
          }
        }

      if (competGameType === 'TIERCE' && selCompetTickets.length) {
        for (const tid of selCompetTickets) {
          await addTicketToCompetition(compId!, tid);
        }
      }
      }

      // Pour gérer competition_bonus_caps
      if (compId) {
        const capsRows = Object.entries(competBonusCaps)
          .filter(([_, value]) => value !== '' && Number(value) > 0)
          .map(([bonusId, value]) => ({
            competition_id: compId,
            bonus_definition: bonusId,
            max_per_user: Number(value),
          }));

        const { error: delCapsErr } = await supabase
          .from('competition_bonus_caps')
          .delete()
          .eq('competition_id', compId);

        if (delCapsErr) {
          throw new Error('competition_bonus_caps.delete: ' + delCapsErr.message);
        }

        if (capsRows.length > 0) {
          const { error: insCapsErr } = await supabase
            .from('competition_bonus_caps')
            .insert(capsRows);

          if (insCapsErr) {
            throw new Error('competition_bonus_caps.insert: ' + insCapsErr.message);
          }
        }
      }

      // Regénération seulement pour GRID
      if (compId && competGameType === 'GRID') {
        const { error: regenErr } = await supabase.rpc(
          'regenerate_grid_matches_for_competition',
          { p_compet_id: compId }
        );
        if (regenErr) {
          throw new Error('rpc.regenerate_grid_matches_for_competition: ' + regenErr.message);
        }
      }

      setMessageCompet(editingCompetId ? '✅ Compétition modifiée' : '✅ Compétition créée');
      setCompetName('');
      setCompetGameType('GRID');
      setSelCompetGrids([]);
      setSelCompetTickets([]);
      setEditingCompetId(null);
      setCompetDescription('');
      setCompetMode('CLASSIC');
      setCompetKind('PUBLIC');
      setCompetXpEnabled(false);
      setCompetBonusCaps({});
    } catch (err: any) {
      console.error('Erreur compétition :', err?.message || err);
      setMessageCompet('❌ ' + (err?.message || 'Erreur'));
    }
  };

  // Importer des matchs pour un ticket
  const handleTierceImport = async () => {
    if (ticketLeagueFilters.length === 0) return;

    const { data: all, error } = await supabase
      .from('matches')
      .select('id, league_name, date, home_team, away_team')
      .gte('date', ticketDateFrom + 'T00:00:00Z')
      .lte('date', ticketDateTo + 'T23:59:59Z')
      .order('date', { ascending: true });

    if (error) {
      console.error(error);
      setTicketMessage('❌ Erreur import matchs : ' + error.message);
      return;
    }

    if (!all) return;

    const newMatches = all.filter((f) =>
      ticketLeagueFilters.includes(f.league_name)
    );

    setTicketAvailableFixtures((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      const merged = [...prev];
      newMatches.forEach((m) => {
        if (!existingIds.has(m.id)) merged.push(m);
      });
      return merged;
    });
  };

  // Pour éditer un ticket
  const startTierceEdit = async (id: string) => {
    setTab('tierceCreate');
    setTicketMessage('');
    setTicketId(id);

    const { data: t, error: ticketErr } = await supabase
      .from('tierce_tickets')
      .select('id, title, description')
      .eq('id', id)
      .single();

    if (ticketErr) {
      console.error(ticketErr);
      setTicketMessage('❌ Erreur chargement ticket : ' + ticketErr.message);
      return;
    }

    if (t) {
      setTicketTitle(t.title || '');
      setTicketDescription(t.description || '');
    }

    const { data: items, error: itemsErr } = await supabase
      .from('tierce_ticket_matches')
      .select('match_id')
      .eq('ticket_id', id);

    if (itemsErr) {
      console.error(itemsErr);
      setTicketMessage('❌ Erreur chargement matchs ticket : ' + itemsErr.message);
      return;
    }

    const mids = items?.map((it) => it.match_id) || [];
    setTicketSelectedFixtures(mids);
    setInitialTicketFixtureIds(mids);

    if (mids.length) {
      const { data: det, error: detErr } = await supabase
        .from('matches')
        .select('id, league_name, date, home_team, away_team')
        .in('id', mids)
        .order('date', { ascending: true });

      if (detErr) {
        console.error(detErr);
        setTicketMessage('❌ Erreur chargement détails matchs : ' + detErr.message);
        return;
      }

      setTicketAvailableFixtures(det || []);
    } else {
      setTicketAvailableFixtures([]);
    }
  };

  //Pour supprimer un ticket
  const handleTierceDelete = async (id: string) => {
    if (!confirm('Supprimer ce ticket ?')) return;

    try {
      await deleteTicketEverywhere(id);
      setTierceTickets((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      console.error(err);
      setTicketMessage(
        '❌ Erreur suppression : ' + (err instanceof Error ? err.message : String(err))
      );
    }
  };

  // Pour enregistrer un ticket
  const handleTierceSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTicket(true);
    setTicketMessage('');

    try {
      if (!ticketTitle.trim()) {
        throw new Error('Le nom du ticket est obligatoire.');
      }

      if (ticketSelectedFixtures.length === 0) {
        throw new Error('Sélectionne au moins un match.');
      }

      let tid = ticketId;

      // 1) Créer / mettre à jour le ticket
      if (ticketId) {
        const { error: updErr } = await supabase
          .from('tierce_tickets')
          .update({
            title: ticketTitle,
            description: ticketDescription,
          })
          .eq('id', ticketId);

        if (updErr) throw new Error('tierce_tickets.update: ' + updErr.message);
      } else {
        const { data: ins, error: insErr } = await supabase
          .from('tierce_tickets')
          .insert([
            {
              title: ticketTitle,
              description: ticketDescription,
            },
          ])
          .select('id')
          .single();

        if (insErr) throw new Error('tierce_tickets.insert: ' + insErr.message);
        tid = ins!.id;
        setTicketId(tid);
      }

      // 2) Diff avant / après
      const before = new Set(initialTicketFixtureIds);
      const after = new Set(ticketSelectedFixtures);

      const toAdd = [...after].filter((mid) => !before.has(mid));
      const toRemove = [...before].filter((mid) => !after.has(mid));

      // 3) Ajouter les nouveaux matchs
      if (toAdd.length) {
        const rows = toAdd.map((mid) => ({
          ticket_id: tid!,
          match_id: mid,
        }));

        const { error: addErr } = await supabase
          .from('tierce_ticket_matches')
          .insert(rows);

        if (addErr) throw new Error('tierce_ticket_matches.insert: ' + addErr.message);
      }

      // 4) Retirer les matchs décochés
      if (toRemove.length) {
        for (const mid of toRemove) {
          await removeMatchFromTicket(tid!, mid);
        }
      }

      // 5) Recharger la liste
      const { data: tt, error: listErr } = await supabase
        .from('tierce_tickets')
        .select('id, title, description, created_at, competition_id')
        .order('created_at', { ascending: false });

      if (listErr) throw new Error('tierce_tickets.select: ' + listErr.message);

      setTierceTickets((tt || []) as TierceTicket[]);

      // 6) Reset
      setTicketMessage('✅ Ticket enregistré');
      setInitialTicketFixtureIds(ticketSelectedFixtures);

      setTicketId(null);
      setTicketTitle('');
      setTicketDescription('');
      setTicketLeagueFilters([]);
      setTicketDateFrom(new Date().toISOString().slice(0, 10));
      setTicketDateTo(new Date().toISOString().slice(0, 10));
      setTicketAvailableFixtures([]);
      setTicketSelectedFixtures([]);
      setTab('tierceList');
    } catch (err: unknown) {
      console.error(err);
      setTicketMessage(
        '❌ Erreur : ' + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setSavingTicket(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Onglets */}
      <div className="flex border-b mb-6">
        <button className={`px-4 py-2 -mb-px ${tab==='create'?'border-b-2 border-blue-600 font-semibold':'text-gray-600'}`} onClick={()=>setTab('create')}>
          {gridId?'Modifier une grille':'Créer grille'}
        </button>
        <button className={`px-4 py-2 ml-4 -mb-px ${tab==='list'?'border-b-2 border-blue-600 font-semibold':'text-gray-600'}`} onClick={()=>setTab('list')}>Liste Grilles</button>
        <button className={`px-4 py-2 ml-4 -mb-px ${tab==='compet'?'border-b-2 border-blue-600 font-semibold':'text-gray-600'}`} onClick={()=>setTab('compet')}>Créer compét</button>
        <button className={`px-4 py-2 ml-4 -mb-px ${tab==='competList'?'border-b-2 border-blue-600 font-semibold':'text-gray-600'}`} onClick={()=>setTab('competList')}>Liste compét</button>
        <button className={`px-4 py-2 ml-4 -mb-px ${tab==='push' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`} onClick={() => setTab('push')} >Envoyer Notifs</button>
        <button className={`px-4 py-2 ml-4 -mb-px ${tab==='xp' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`} onClick={() => setTab('xp')} >Donner XP</button>
        <button className={`px-4 py-2 ml-4 -mb-px ${tab==='eliminations' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`} onClick={() => setTab('eliminations')}>Créer Éliminé</button>
        <button className={`px-4 py-2 ml-4 -mb-px ${tab==='boosts' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`} onClick={() => setTab('boosts')}>Donner Boosts</button>
        <button className={`px-4 py-2 ml-4 -mb-px ${tab==='tierceCreate' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`}  onClick={() => setTab('tierceCreate')} >Créer Ticket</button>
        <button className={`px-4 py-2 ml-4 -mb-px ${tab==='tierceList' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`}  onClick={() => setTab('tierceList')} >Liste Tickets</button>
        <button className={`px-4 py-2 ml-4 -mb-px ${tab==='attendance' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-600'}`}  onClick={() => setTab('attendance')} >Affluences</button>
      </div>

      {/* Création / Modification Grille */}
      {tab === 'create' && (
        <form onSubmit={handleSave} className="space-y-6">
          {message && (
            <div className="p-3 bg-green-100 text-green-800 rounded">
              {message}
            </div>
          )}

          {/* Titre */}
          <div>
            <label className="block mb-1 font-medium">
              Titre de la grille
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block mb-1 font-medium">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full border rounded p-2"
              placeholder="Décris ici les règles spécifiques de cette grille…"
            />
          </div>

          {/* Competition + dates + bouton GO sur une même ligne */}
          <div className="flex items-end space-x-4 mb-6">
            {/* Competition prend tout l’espace restant */}
            <div className="flex-1">
              <label className="block mb-1 font-medium">Compétition</label>
              <select
                value={competitionFilter}
                onChange={e => setCompetitionFilter(e.target.value)}
                className="w-full border rounded p-2"
              >
                <option value="">— Choisir —</option>
                {competitions.map((c,i)=>(
                  <option key={`${c}-${i}`} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Date début avec largeur fixe */}
            <div className="w-32">
              <label className="block mb-1 font-medium">Date début</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e=>setDateFrom(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>

            {/* Date fin avec même largeur */}
            <div className="w-32">
              <label className="block mb-1 font-medium">Date fin</label>
              <input
                type="date"
                value={dateTo}
                onChange={e=>setDateTo(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>

            {/* Bouton GO */}
            <button
              type="button"
              onClick={handleImport}
              disabled={!competitionFilter}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              GO
            </button>
          </div>


          {/* Double colonne de sélection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium mb-2">Matchs disponibles</p>
              <div className="border rounded h-64 overflow-auto">
                {availableFixtures
                  .filter((f) => !selectedFixtures.includes(f.id))
                  .map((f) => (
                    <div
                      key={f.id}
                      onClick={() => addFixture(f.id)}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {new Date(f.date).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      — {f.home_team} vs {f.away_team}
                    </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-medium mb-2">
                Matchs sélectionnés
              </p>
              <div className="border rounded h-64 overflow-auto">
                {fixtures
                  .filter((f) => selectedFixtures.includes(f.id))
                  .map((f) => (
                    <div
                      key={f.id}
                      onClick={() => removeFixture(f.id)}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {new Date(f.date).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      — {f.home_team} vs {f.away_team}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Bonus autorisés */}
          <div>
<div className="flex items-center justify-between mb-2">
  <p className="font-medium">Bonus autorisés</p>

  <label className="inline-flex items-center text-sm cursor-pointer">
    <input
      type="checkbox"
      checked={allBonusesChecked}
      onChange={toggleAllBonuses}
      className="form-checkbox h-4 w-4 text-blue-600"
    />
    <span className="ml-2">Tout cocher</span>
  </label>
</div>
            <div className="flex flex-wrap gap-4">
              {bonusDefs.map((b) => (
                <label
                  key={b.id}
                  className="inline-flex items-center"
                >
                  <input
                    type="checkbox"
                    value={b.id}
                    checked={allowedBonuses.includes(b.id)}
                    onChange={(e) => {
                      const id = e.currentTarget.value;
                      setAllowedBonuses((arr) =>
                        arr.includes(id)
                          ? arr.filter((x) => x !== id)
                          : [...arr, id]
                      );
                    }}
                    className="form-checkbox h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2">{b.name}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer la grille'}
          </button>
        </form>
      )}

      {/* Liste des grilles */}
      {tab === 'list' && (
        <div className="space-y-4">
          {loadingGrids ? (
            <div>Chargement…</div>
          ) : grids.length === 0 ? (
            <div>Aucune grille trouvée.</div>
          ) : (
            grids.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between border p-4 rounded"
              >
                <div>
                  <div className="font-semibold">{g.title}</div>
                  <div className="text-sm text-gray-600">
                    Créée le{' '}
                    {new Date(
                      g.created_at
                    ).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => startEdit(g.id)}
                    className="px-4 py-2 bg-yellow-400 text-white rounded hover:bg-yellow-500"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Création / édition de compétition */}
      {tab==='compet' && (
        <form onSubmit={handleCompetSubmit} className="space-y-6">
          {messageCompet && (
            <div className={`p-3 rounded ${messageCompet.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {messageCompet}
            </div>
          )}

          {/* Nom de la compétition */}
          <div>
            <label className="block mb-1 font-medium">Nom de la compétition</label>
            <input
              type="text"
              value={competName}
              onChange={e => setCompetName(e.target.value)}
              required
              className="w-full border rounded p-2"
            />
          </div>

          {/* Description de la compétition */}
          <div>
            <label className="block mb-1 font-medium">Description</label>
            <textarea
              value={competDescription}
              onChange={e => setCompetDescription(e.target.value)}
              rows={3}
              className="w-full border rounded p-2"
            />
          </div>

          {/* Mode de la compétition */}
          <div>
            <label className="block mb-1 font-medium">Mode</label>
            <select
              value={competMode}
              onChange={e => setCompetMode(e.target.value as 'CLASSIC' | 'TOURNOI')}
              className="w-full border rounded p-2"
            >
              <option value="CLASSIC">CLASSIC</option>
              <option value="TOURNOI">TOURNOI</option>
            </select>
          </div>

          {/* Kind de la ompétition : Privé ou Public */}
          <div>
            <label className="block mb-1 font-medium">Visibilité</label>
            <select
              value={competKind}
              onChange={e => setCompetKind(e.target.value as 'PUBLIC' | 'PRIVATE')}
              className="w-full border rounded p-2"
            >
              <option value="PUBLIC">PUBLIC</option>
              <option value="PRIVATE">PRIVATE</option>
            </select>
          </div>

          {/* XP activé ? */}
          <div>
            <label className="inline-flex items-center space-x-2">
              <input
                type="checkbox"
                checked={competXpEnabled}
                onChange={e => setCompetXpEnabled(e.target.checked)}
              />
              <span>XP activé</span>
            </label>
          </div>

          {/* Type de la compétition */}
          <div>
            <label className="block mb-1 font-medium">Type de jeu</label>
            <select
              value={competGameType}
              onChange={e => setCompetGameType(e.target.value as 'GRID' | 'TIERCE')}
              className="w-full border rounded p-2"
            >
              <option value="GRID">Grilles</option>
              <option value="TIERCE">Tickets TIERCE</option>
            </select>
          </div>

          {competGameType === 'GRID' && (
            <div>
              <label className="block mb-1 font-medium">Grilles à associer</label>
              <div className="space-y-1 max-h-48 overflow-auto border rounded p-2">
                {grids
                  .filter(g => g.is_private_template === false)
                  .map(g => (
                  <label key={g.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      value={g.id}
                      checked={selCompetGrids.includes(g.id)}
                      onChange={() =>
                        setSelCompetGrids(curr =>
                          curr.includes(g.id)
                            ? curr.filter(x => x !== g.id)
                            : [...curr, g.id]
                        )
                      }
                    />
                    <span>{g.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {competGameType === 'TIERCE' && (
            <div>
              <label className="block mb-1 font-medium">Tickets à associer</label>
              <div className="space-y-1 max-h-48 overflow-auto border rounded p-2">
                {tierceTickets.map(t => (
                  <label key={t.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      value={t.id}
                      checked={selCompetTickets.includes(t.id)}
                      onChange={() =>
                        setSelCompetTickets(curr =>
                          curr.includes(t.id)
                            ? curr.filter(x => x !== t.id)
                            : [...curr, t.id]
                        )
                      }
                    />
                    <span>{t.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block mb-2 font-medium">Cap des bonus par joueur</label>
            <div className="space-y-2 border rounded p-3">
              {bonusDefs.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium">{b.code}</div>
                    <div className="text-sm text-gray-500">{b.name}</div>
                  </div>

                  <input
                    type="number"
                    min="1"
                    value={competBonusCaps[b.id] ?? ''}
                    onChange={(e) =>
                      setCompetBonusCaps((prev) => ({
                        ...prev,
                        [b.id]: e.target.value,
                      }))
                    }
                    className="w-24 border rounded p-2"
                    placeholder="∞"
                  />
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-500 mt-2">
              Laisse vide si tu ne veux pas limiter ce bonus.
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {editingCompetId ? 'Modifier la compétition' : 'Créer la compétition'}
          </button>
        </form>
      )}

      {/* Liste des compétitions */}
      {tab==='competList' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Liste des compétitions</h2>
          {loadingComps
            ? <div>🔄 Chargement des compétitions…</div>
            : comps.length === 0
              ? <div>Aucune compétition</div>
              : (
                <ul className="space-y-2">
                  {comps.map(c=>(
                    <li
                      key={c.id}
                      className="flex items-center justify-between border rounded p-3"
                    >
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-sm text-gray-500">
                          Créée le {new Date(c.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <div className="space-x-2">
                      <button
                        onClick={async () => {
                          setTab('compet');
                          setMessageCompet(null);

                          setCompetName(c.name);
                          setEditingCompetId(c.id);
                          setCompetGameType((c.game_type as 'GRID' | 'TIERCE') || 'GRID');
                          setCompetDescription(c.description || '');
                          setCompetMode((c.mode as 'CLASSIC' | 'TOURNOI') || 'CLASSIC');
                          setCompetKind((c.kind as 'PUBLIC' | 'PRIVATE') || 'PUBLIC');
                          setCompetXpEnabled(!!c.xp_enabled);

                          setSelCompetGrids([]);
                          setSelCompetTickets([]);
                          setCompetBonusCaps({});

                          // Charger les caps bonus
                          const { data: caps, error: capsErr } = await supabase
                            .from('competition_bonus_caps')
                            .select('bonus_definition,max_per_user')
                            .eq('competition_id', c.id);

                          if (capsErr) {
                            console.error(capsErr);
                            setMessageCompet('❌ Erreur chargement caps bonus : ' + capsErr.message);
                            return;
                          }

                          const capsMap: Record<string, string> = {};
                          (caps || []).forEach((row) => {
                            capsMap[row.bonus_definition] = String(row.max_per_user);
                          });
                          setCompetBonusCaps(capsMap);

                          if (c.game_type === 'TIERCE') {
                            const { data: links, error: linksErr } = await supabase
                              .from('competition_tickets')
                              .select('ticket_id')
                              .eq('competition_id', c.id);

                            if (linksErr) {
                              console.error(linksErr);
                              setMessageCompet('❌ Erreur chargement tickets : ' + linksErr.message);
                              return;
                            }

                            setSelCompetTickets(links?.map(x => x.ticket_id) || []);
                          } else {
                            const { data: links, error: linksErr } = await supabase
                              .from('competition_grids')
                              .select('grid_id')
                              .eq('competition_id', c.id);

                            if (linksErr) {
                              console.error(linksErr);
                              setMessageCompet('❌ Erreur chargement grilles : ' + linksErr.message);
                              return;
                            }

                            setSelCompetGrids(links?.map(x => x.grid_id) || []);
                          }
                        }}
                        className="px-3 py-1 border rounded hover:bg-gray-100"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Supprimer cette compétition (et détacher ses éléments) ?')) return;

                          if (c.game_type === 'TIERCE') {
                            const { data: links } = await supabase
                              .from('competition_tickets')
                              .select('ticket_id')
                              .eq('competition_id', c.id);

                            for (const row of (links ?? [])) {
                              await removeTicketFromCompetition(c.id, row.ticket_id);
                            }
                          } else {
                            const { data: links } = await supabase
                              .from('competition_grids')
                              .select('grid_id')
                              .eq('competition_id', c.id);

                            for (const row of (links ?? [])) {
                              await removeGridFromCompetition(c.id, row.grid_id);
                            }
                          }

                          const { error: capsDelErr } = await supabase
                            .from('competition_bonus_caps')
                            .delete()
                            .eq('competition_id', c.id);

                          if (capsDelErr) {
                            throw new Error('competition_bonus_caps.delete: ' + capsDelErr.message);
                          }

                          await supabase.from('competitions').delete().eq('id', c.id);

                          setComps(cs => cs.filter(x => x.id !== c.id));
                        }}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Supprimer
                      </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )
          }
        </div>
      )}

      {/* Pour envoyer des notifs ponctuelles */}
      {tab === 'push' && (
        <div className="mt-6">
          <AdminPushPanel />
        </div>
      )}

      {/* Pour ajouter des XP */}
      {tab === 'xp' && (
        <div className="mt-6">
          <AdminXpPanel />
        </div>
      )}

      {/* Pour ajouter des éliminés */}
      {tab === 'eliminations' && (
        <div className="mt-6">
          <AdminEliminationsPanel />
        </div>
      )}

      {/* Pour donner des bonus boost */}
      {tab === 'boosts' && (
        <div className="mt-6">
          <AdminBoostPanel />
        </div>
      )}

      {/* Pour créer des tickets de tiercé */}
      {tab === 'tierceCreate' && (
        <form onSubmit={handleTierceSave} className="space-y-6">
          {ticketMessage && (
            <div className="p-3 bg-green-100 text-green-800 rounded">
              {ticketMessage}
            </div>
          )}

          <div>
            <label className="block mb-1 font-medium">
              {ticketId ? 'Modifier un ticket' : 'Nom du ticket'}
            </label>
            <input
              type="text"
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              className="w-full border rounded p-2"
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Description</label>
            <textarea
              value={ticketDescription}
              onChange={(e) => setTicketDescription(e.target.value)}
              rows={3}
              className="w-full border rounded p-2"
              placeholder="Décris ici le ticket TIERCE…"
            />
          </div>

          <div className="flex items-end space-x-4 mb-6">
            <div className="flex-1">
              <label className="block mb-1 font-medium">Ligues</label>
              <select
                onChange={(e) => {
                  const value = e.target.value;
                  if (value && !ticketLeagueFilters.includes(value)) {
                    setTicketLeagueFilters((prev) => [...prev, value]);
                  }
                }}
                className="w-full border rounded p-2"
              >
                <option value="">— Choisir —</option>
                {competitions.map((c, i) => (
                  <option key={`${c}-${i}`} value={c}>{c}</option>
                ))}
              </select>

              {ticketLeagueFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {ticketLeagueFilters.map((league) => (
                    <button
                      key={league}
                      type="button"
                      onClick={() =>
                        setTicketLeagueFilters((prev) =>
                          prev.filter((l) => l !== league)
                        )
                      }
                      className="px-2 py-1 bg-gray-200 rounded text-sm"
                    >
                      {league} ✕
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-32">
              <label className="block mb-1 font-medium">Date début</label>
              <input
                type="date"
                value={ticketDateFrom}
                onChange={(e) => setTicketDateFrom(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>

            <div className="w-32">
              <label className="block mb-1 font-medium">Date fin</label>
              <input
                type="date"
                value={ticketDateTo}
                onChange={(e) => setTicketDateTo(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>

            <button
              type="button"
              onClick={handleTierceImport}
              disabled={ticketLeagueFilters.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              GO
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium mb-2">Matchs disponibles</p>
              <div className="border rounded h-64 overflow-auto">
                {ticketAvailableFixtures
                  .filter((f) => !ticketSelectedFixtures.includes(f.id))
                  .map((f) => (
                    <div
                      key={f.id}
                      onClick={() => addTierceFixture(f.id)}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {new Date(f.date).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      — {f.home_team} vs {f.away_team}
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <p className="font-medium mb-2">Matchs sélectionnés</p>
              <div className="border rounded h-64 overflow-auto">
                {ticketAvailableFixtures
                  .filter((f) => ticketSelectedFixtures.includes(f.id))
                  .map((f) => (
                    <div
                      key={f.id}
                      onClick={() => removeTierceFixture(f.id)}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {new Date(f.date).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      — {f.home_team} vs {f.away_team}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingTicket}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {savingTicket ? 'Enregistrement…' : ticketId ? 'Modifier le ticket' : 'Enregistrer le ticket'}
          </button>
        </form>
      )}

      {/* Liste des tickets de tiercé */}
      {tab === 'tierceList' && (
        <div className="space-y-4">
          {loadingTierceTickets ? (
            <div>Chargement…</div>
          ) : tierceTickets.length === 0 ? (
            <div>Aucun ticket trouvé.</div>
          ) : (
            tierceTickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border p-4 rounded"
              >
                <div>
                  <div className="font-semibold">{t.title}</div>
                  <div className="text-sm text-gray-600">
                    Créé le{' '}
                    {new Date(t.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => startTierceEdit(t.id)}
                    className="px-4 py-2 bg-yellow-400 text-white rounded hover:bg-yellow-500"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleTierceDelete(t.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pour remplir les affluences */}
      {tab === 'attendance' && (
        <div className="mt-6">
          <AdminAttendancePanel />
        </div>
      )}
    </div>
);
}