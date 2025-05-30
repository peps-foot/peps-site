'use client'

import React, { useState, useEffect } from 'react'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

const supabase = createBrowserSupabaseClient()

// --- Types ---
type BonusDef    = { id: string; code: string; name: string }
type Fixture     = { id: number; competition: string; date: string; home_team: string; away_team: string }
type Grid        = { id: string; title: string; description: string; created_at: string; allowed_bonuses: string[] }
type Competition = { id: string; name: string; created_at: string }

// -----------------------------
// Helper: fetch “MATCH” cat ID
// -----------------------------
async function getBonusCategoryId(name: string): Promise<string|null> {
  const { data, error } = await supabase
    .from<{ id: string }>('bonus_categories')
    .select('id')
    .eq('name', name)
    .single()

  if (error || !data) {
    console.error('Erreur getBonusCategoryId', error)
    return null
  }
  return data.id
}

export default function AdminGridsClient() {
  const router = useRouter()

  // -----------------------------
  // 0) Redirect if not admin
  // -----------------------------
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.replace('/connexion')
      }
    })()
  }, [router])

  // -----------------------------
  // Tabs: create / list / compet / competList
  // -----------------------------
  const [tab, setTab] = useState<'create'|'list'|'compet'|'competList'>('create')

  // -----------------------------
  // Grid form state
  // -----------------------------
  const [gridId, setGridId]                     = useState<string|null>(null)
  const [title, setTitle]                       = useState('')
  const [description, setDescription]           = useState('')
  const [allowedBonuses, setAllowedBonuses]     = useState<string[]>([])
  const [fixtures, setFixtures]                 = useState<Fixture[]>([])
  const [selectedFixtures, setSelectedFixtures] = useState<number[]>([])
  const [competitionFilter, setCompetitionFilter] = useState('')
  const [dateFrom, setDateFrom]                 = useState(new Date().toISOString().slice(0,10))
  const [dateTo, setDateTo]                     = useState(new Date().toISOString().slice(0,10))
  const [saving, setSaving]                     = useState(false)
  const [message, setMessage]                   = useState<string|null>(null)

  // -----------------------------
  // Competition form state
  // -----------------------------
  const [competName, setCompetName]             = useState('')
  const [selCompetGrids, setSelCompetGrids]     = useState<string[]>([])
  const [editingCompetId, setEditingCompetId]   = useState<string|null>(null)
  const [messageCompet, setMessageCompet]       = useState<string|null>(null)

  // -----------------------------
  // Shared data
  // -----------------------------
  const [bonusDefs, setBonusDefs]       = useState<BonusDef[]>([])
  const [competitions, setCompetitions] = useState<string[]>([])
  const [grids, setGrids]               = useState<Grid[]>([])
  const [comps, setComps]               = useState<Competition[]>([])

  const [loadingDefs, setLoadingDefs]   = useState(true)
  const [loadingComps, setLoadingComps] = useState(true)
  const [loadingGrids, setLoadingGrids] = useState(true)

  // -----------------------------
  // Initial load: defs, comps, grids
  // -----------------------------
  useEffect(() => {
    (async () => {
      // 1) Bonus definitions (MATCH category)
      const catId = await getBonusCategoryId('MATCH')
      if (catId) {
        const { data: defs, error } = await supabase
          .from<BonusDef>('bonus_definition')
          .select('id,code,name')
          .eq('category_id', catId)
        if (!error && defs) setBonusDefs(defs)
        if (error) console.error('fetch bonus_defs', error)
      }
      setLoadingDefs(false)

      // 2) Distinct competitions
      const { data: comps2 } = await supabase
        .from<{ competition: string }>('matches')
        .select('competition', { distinct: true })
      if (comps2) {
        // build a Set to drop duplicates, then back to array
        const uniqueLeagues = Array.from(new Set(comps2.map(c => c.competition)));
        setCompetitions(uniqueLeagues);
        }
      setLoadingComps(false)

      // 3) All grids
      const { data: gs, error: errGs } = await supabase
        .from<Grid>('grids')
        .select('id,title,description,created_at,allowed_bonuses')
        .order('created_at', { ascending: false })
      if (!errGs && gs) setGrids(gs)
      setLoadingGrids(false)

      // 4) All competitions
      const { data: allComps, error: errAllComps } = await supabase
        .from<Competition>('competitions')
        .select('id,name,created_at')
        .order('created_at', { ascending: false })
      if (!errAllComps && allComps) setComps(allComps)
    })()
  }, [])

  // -----------------------------
  // Utils for fixtures pick
  // -----------------------------
  const addFixture    = (id: number) => setSelectedFixtures(s => [...s, id])
  const removeFixture = (id: number) => setSelectedFixtures(s => s.filter(x=>x!==id))

  // -----------------------------
  // Import fixtures by filter+dates
  // -----------------------------
  const handleImport = async () => {
    if (!competitionFilter) return
    const { data: all } = await supabase
      .from<Fixture>('matches')
      .select('id,competition,date,home_team,away_team')
      .gte('date', dateFrom + 'T00:00:00Z')
      .lte('date', dateTo   + 'T23:59:59Z')
    if (!all) return
    const next = all.filter(f => f.competition === competitionFilter)
    setFixtures(next)
    setSelectedFixtures(s => s.filter(id => next.some(f=>f.id===id)))
  }

  // -----------------------------
  // Save (create/update) a grid
  // -----------------------------
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      let gid = gridId
      if (gid) {
        await supabase
          .from('grids')
          .update({ title, description, allowed_bonuses: allowedBonuses })
          .eq('id', gid)
      } else {
        const { data: ins, error } = await supabase
          .from('grids')
          .insert([{ title, description, allowed_bonuses: allowedBonuses }])
          .select('id')
        if (error) throw error
        gid = ins![0].id
      }
      // grid_items
      await supabase.from('grid_items').delete().eq('grid_id', gid)
      if (selectedFixtures.length) {
        const links = selectedFixtures.map(mid=>({ grid_id: gid!, match_id: mid }))
        await supabase.from('grid_items').insert(links)
      }
      setMessage('✅ Grille enregistrée')
      // reset form
      setGridId(null)
      setTitle('')
      setDescription('')
      setCompetitionFilter('')
      setDateFrom(new Date().toISOString().slice(0,10))
      setDateTo(new Date().toISOString().slice(0,10))
      setFixtures([])
      setSelectedFixtures([])
      setAllowedBonuses([])
      setTab('list')
      // reload grids
      const { data: reloadGs } = await supabase
        .from<Grid>('grids')
        .select('id,title,description,created_at,allowed_bonuses')
        .order('created_at', { ascending: false })
      if (reloadGs) setGrids(reloadGs)
    } catch (err: any) {
      console.error(err)
      setMessage('❌ Erreur : ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // -----------------------------
  // Load an existing grid into form
  // -----------------------------
  const startEdit = async (id: string) => {
    setTab('create')
    setMessage(null)
    setGridId(id)
    const { data: g } = await supabase
      .from<Grid>('grids')
      .select('title,allowed_bonuses,description')
      .eq('id', id)
      .single()
    if (g) {
      setTitle(g.title)
      setAllowedBonuses(g.allowed_bonuses)
      setDescription(g.description || '')
    }
    const { data: items } = await supabase
      .from<{ match_id: number }>('grid_items')
      .select('match_id')
      .eq('grid_id', id)
    const mids = items?.map(x=>x.match_id) || []
    setSelectedFixtures(mids)
    if (mids.length) {
      const { data: det } = await supabase
        .from<Fixture>('matches')
        .select('*')
        .in('id', mids)
      setFixtures(det || [])
    }
  }

  // -----------------------------
  // Delete a grid
  // -----------------------------
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette grille ?')) return
    await supabase.from('grids').delete().eq('id', id)
    setGrids(gs => gs.filter(g=>g.id!==id))
  }

  // -----------------------------
  // handleCompetSubmit
  // -----------------------------
  const handleCompetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessageCompet(null)
    try {
      let compId = editingCompetId
      if (compId) {
        await supabase
          .from('competitions')
          .update({ name: competName })
          .eq('id', compId)
        await supabase
          .from('competition_grids')
          .delete()
          .eq('competition_id', compId)
        setComps(cs =>
          cs.map(c => c.id===compId ? { ...c, name: competName } : c)
        )
      } else {
        const { data: comp, error: compErr } = await supabase
          .from('competitions')
          .insert([{ name: competName }])
          .select('id,name,created_at')
          .single()
        if (compErr) throw compErr
        compId = comp.id
        setComps(cs => [{ id: comp.id, name: comp.name, created_at: comp.created_at }, ...cs])
      }
      if (compId && selCompetGrids.length) {
        const links = selCompetGrids.map(grid_id=>({ competition_id: compId!, grid_id }))
        const { error: linkErr } = await supabase
          .from('competition_grids')
          .insert(links)
        if (linkErr) throw linkErr
      }
      setMessageCompet(editingCompetId ? '✅ Compétition modifiée' : '✅ Compétition créée')
      setCompetName('')
      setSelCompetGrids([])
      setEditingCompetId(null)
      setTab('competList')
    } catch(err:any) {
      console.error('Erreur compétition :', err)
      setMessageCompet('❌ ' + (err.message||'Erreur inattendue'))
    }
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          className={`px-4 py-2 -mb-px ${
            tab==='create'
              ? 'border-b-2 border-blue-600 font-semibold'
              : 'text-gray-600'
          }`}
          onClick={()=>setTab('create')}
        >
          {gridId ? 'Modifier une grille' : 'Créer une grille'}
        </button>
        <button
          className={`px-4 py-2 ml-4 -mb-px ${
            tab==='list'
              ? 'border-b-2 border-blue-600 font-semibold'
              : 'text-gray-600'
          }`}
          onClick={()=>setTab('list')}
        >
          Liste des grilles
        </button>
        <button
          className={`px-4 py-2 ml-4 -mb-px ${
            tab==='compet'
              ? 'border-b-2 border-blue-600 font-semibold'
              : 'text-gray-600'
          }`}
          onClick={()=>setTab('compet')}
        >
          Compétitions
        </button>
        <button
          className={`px-4 py-2 ml-4 -mb-px ${
            tab==='competList'
              ? 'border-b-2 border-blue-600 font-semibold'
              : 'text-gray-600'
          }`}
          onClick={()=>setTab('competList')}
        >
          Liste des compétitions
        </button>
      </div>

      {/* CREATE / EDIT GRID */}
      {tab==='create' && (
        <form onSubmit={handleSave} className="space-y-6">
          {message && (
            <div className={`p-3 rounded ${
              message.startsWith('✅')
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {message}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block mb-1 font-medium">Titre</label>
            <input
              type="text"
              value={title}
              onChange={e=>setTitle(e.target.value)}
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block mb-1 font-medium">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={e=>setDescription(e.target.value)}
              className="w-full border rounded p-2"
            />
          </div>

          {/* Import fixtures row */}
          <div className="flex items-end space-x-4 mb-6">
            <div className="flex-1">
              <label className="block mb-1 font-medium">Compétition</label>
              <select
                value={competitionFilter}
                onChange={e=>setCompetitionFilter(e.target.value)}
                className="w-full border rounded p-2"
              >
                <option value="">— Choisir —</option>
                {competitions.map((c,i)=><option key={i} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="w-32">
              <label className="block mb-1 font-medium">Date début</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e=>setDateFrom(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>

            <div className="w-32">
              <label className="block mb-1 font-medium">Date fin</label>
              <input
                type="date"
                value={dateTo}
                onChange={e=>setDateTo(e.target.value)}
                className="w-full border rounded p-2"
              />
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={!competitionFilter}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              GO
            </button>
          </div>

          {/* Fixtures lists */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium mb-2">Disponibles</p>
              <div className="border rounded h-64 overflow-auto">
                {fixtures.filter(f=>!selectedFixtures.includes(f.id)).map(f=>(
                  <div
                    key={f.id}
                    onClick={()=>addFixture(f.id)}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {new Date(f.date).toLocaleString('fr-FR',{ day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                    — {f.home_team} vs {f.away_team}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-medium mb-2">Sélectionnés</p>
              <div className="border rounded h-64 overflow-auto">
                {fixtures.filter(f=>selectedFixtures.includes(f.id)).map(f=>(
                  <div
                    key={f.id}
                    onClick={()=>removeFixture(f.id)}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {new Date(f.date).toLocaleString('fr-FR',{ day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                    — {f.home_team} vs {f.away_team}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bonus checkboxes */}
          <div>
            <p className="font-medium mb-2">Bonus autorisés</p>
            <div className="flex flex-wrap gap-4">
              {bonusDefs.map(b=>(
                <label key={b.id} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    value={b.id}
                    checked={allowedBonuses.includes(b.id)}
                    onChange={e=>{
                      const id = e.currentTarget.value
                      setAllowedBonuses(arr =>
                        arr.includes(id)
                          ? arr.filter(x=>x!==id)
                          : [...arr,id]
                      )
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
            {saving ? 'Enregistrement…' : (gridId?'Modifier':'Créer')}
          </button>
        </form>
      )}

      {/* LIST GRIDS */}
      {tab==='list' && (
        <div className="space-y-4">
          {loadingGrids
            ? <div>Chargement…</div>
            : grids.length===0
              ? <div>Aucune grille trouvée.</div>
              : grids.map(g=>(
                <div key={g.id} className="flex items-center justify-between border p-4 rounded">
                  <div>
                    <div className="font-semibold">{g.title}</div>
                    <div className="text-sm text-gray-600">
                      Créée le {new Date(g.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={()=>startEdit(g.id)} className="px-4 py-2 bg-yellow-400 text-white rounded hover:bg-yellow-500">
                      Modifier
                    </button>
                    <button onClick={()=>handleDelete(g.id)} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                      Supprimer
                    </button>
                  </div>
                </div>
              ))
          }
        </div>
      )}

      {/* CREATE/EDIT COMPETITION */}
      {tab==='compet' && (
        <form onSubmit={handleCompetSubmit} className="space-y-6">
          {messageCompet && (
            <div className={`p-3 rounded ${
              messageCompet.startsWith('✅')
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {messageCompet}
            </div>
          )}

          <div>
            <label className="block mb-1 font-medium">Nom de la compétition</label>
            <input
              type="text"
              value={competName}
              onChange={e=>setCompetName(e.target.value)}
              className="w-full border rounded p-2"
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Grilles à associer</label>
            <div className="space-y-1 max-h-48 overflow-auto border rounded p-2">
              {grids.map(g=>(
                <label key={g.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    value={g.id}
                    checked={selCompetGrids.includes(g.id)}
                    onChange={()=>setSelCompetGrids(curr=>
                      curr.includes(g.id)
                        ? curr.filter(x=>x!==g.id)
                        : [...curr,g.id]
                    )}
                  />
                  <span>{g.title}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            {editingCompetId ? 'Modifier la compétition' : 'Créer la compétition'}
          </button>
        </form>
      )}

      {/* LIST COMPETITIONS */}
      {tab==='competList' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Liste des compétitions</h2>
          {loadingComps
            ? <div>🔄 Chargement des compétitions…</div>
            : comps.length===0
              ? <div>Aucune compétition</div>
              : (
                <ul className="space-y-2">
                  {comps.map(c=>(
                    <li key={c.id} className="flex items-center justify-between border rounded p-3">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-sm text-gray-500">
                          Créée le {new Date(c.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={async ()=>{
                            setTab('compet')
                            setMessageCompet(null)
                            setCompetName(c.name)
                            setEditingCompetId(c.id)
                            const { data: links } = await supabase
                              .from('competition_grids')
                              .select('grid_id')
                              .eq('competition_id', c.id)
                            setSelCompetGrids(links?.map(x=>x.grid_id)||[])
                          }}
                          className="px-3 py-1 border rounded hover:bg-gray-100"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={async ()=>{
                            if (!confirm('Supprimer cette compétition ?')) return
                            await supabase
                              .from('competition_grids')
                              .delete()
                              .eq('competition_id', c.id)
                            await supabase
                              .from('competitions')
                              .delete()
                              .eq('id', c.id)
                            setComps(cs => cs.filter(x=>x.id!==c.id))
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
    </div>
  )
}
