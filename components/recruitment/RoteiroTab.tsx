import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Input } from '../ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import {
  X,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Link,
} from 'lucide-react'

export default function RoteiroTab({ jobId }: { jobId: string }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  interface Script {
    id: string
    name: string
    content: string
    softskills: string[]
    cultural_fit: string[]
  }

  const [scripts, setScripts] = useState<Script[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const [softskills, setSoftskills] = useState<string[]>([])
  const [fits, setFits] = useState<string[]>([])
  const [showSidebar, setShowSidebar] = useState<null | 'soft' | 'fit'>(null)
  const [criterion, setCriterion] = useState('')

  const [formats, setFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    unordered: false,
    ordered: false,
    h1: false,
    h2: false,
    h3: false,
    quote: false,
  })

  function updateToolbar() {
    setFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      unordered: document.queryCommandState('insertUnorderedList'),
      ordered: document.queryCommandState('insertOrderedList'),
      h1: document.queryCommandValue('formatBlock') === 'h1',
      h2: document.queryCommandValue('formatBlock') === 'h2',
      h3: document.queryCommandValue('formatBlock') === 'h3',
      quote: document.queryCommandValue('formatBlock') === 'blockquote',
    })
  }

  useEffect(() => {
    document.addEventListener('selectionchange', updateToolbar)
    return () => document.removeEventListener('selectionchange', updateToolbar)
  }, [])

  useEffect(() => {
    loadScripts()
  }, [jobId])

  async function loadScripts() {
    const { data } = await supabase
      .from('job_scripts')
      .select('id,name,content,softskills,cultural_fit')
      .eq('job_id', jobId)
    if (data) {
      setScripts(data)
      if (data.length) {
        const s = data[0]
        setCurrentId(s.id)
        setName(s.name)
        if (editorRef.current) editorRef.current.innerHTML = s.content || ''
        setSoftskills(s.softskills || [])
        setFits(s.cultural_fit || [])
        updateToolbar()
      }
    }
  }

  function selectScript(id: string) {
    const s = scripts.find((sc) => sc.id === id)
    if (!s) return
    setCurrentId(s.id)
    setName(s.name)
    if (editorRef.current) editorRef.current.innerHTML = s.content || ''
    setSoftskills(s.softskills || [])
    setFits(s.cultural_fit || [])
    updateToolbar()
  }

  async function save() {
    const content = editorRef.current?.innerHTML || ''
    const { data } = await supabase
      .from('job_scripts')
      .upsert({
        id: currentId || undefined,
        job_id: jobId,
        name,
        content,
        softskills,
        cultural_fit: fits,
      })
      .select()
      .single()
    if (data) {
      setCurrentId(data.id)
      loadScripts()
    }
  }

  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value)
    updateToolbar()
  }

  function addCriterion() {
    if (!criterion.trim()) return
    if (showSidebar === 'soft') {
      setSoftskills([...softskills, criterion.trim()])
    } else if (showSidebar === 'fit') {
      setFits([...fits, criterion.trim()])
    }
    setCriterion('')
    setShowSidebar(null)
  }

  function removeItem(idx: number, type: 'soft' | 'fit') {
    if (type === 'soft') {
      setSoftskills(softskills.filter((_, i) => i !== idx))
    } else {
      setFits(fits.filter((_, i) => i !== idx))
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Input
          placeholder="Nome do roteiro"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <select
          className="border p-2 rounded"
          value={currentId || ''}
          onChange={(e) => selectScript(e.target.value)}
        >
          <option value="">Carregar roteiro...</option>
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={save}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Salvar roteiro
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Roteiro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                onClick={() => exec('bold')}
                title="Negrito"
                className={`p-1 rounded ${formats.bold ? 'bg-gray-200' : ''}`}
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                onClick={() => exec('italic')}
                title="Itálico"
                className={`p-1 rounded ${formats.italic ? 'bg-gray-200' : ''}`}
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                onClick={() => exec('underline')}
                title="Sublinhado"
                className={`p-1 rounded ${formats.underline ? 'bg-gray-200' : ''}`}
              >
                <Underline className="h-4 w-4" />
              </button>
              <button
                onClick={() => exec('strikeThrough')}
                title="Tachado"
                className={`p-1 rounded ${formats.strike ? 'bg-gray-200' : ''}`}
              >
                <Strikethrough className="h-4 w-4" />
              </button>
              <button
                onClick={() => exec('insertUnorderedList')}
                title="Lista"
                className={`p-1 rounded ${formats.unordered ? 'bg-gray-200' : ''}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => exec('insertOrderedList')}
                title="Lista numerada"
                className={`p-1 rounded ${formats.ordered ? 'bg-gray-200' : ''}`}
              >
                <ListOrdered className="h-4 w-4" />
              </button>
              <button
                onClick={() => exec('formatBlock', '<h1>')}
                title="H1"
                className={`p-1 rounded ${formats.h1 ? 'bg-gray-200' : ''}`}
              >
                <Heading1 className="h-4 w-4" />
              </button>
              <button
                onClick={() => exec('formatBlock', '<h2>')}
                title="H2"
                className={`p-1 rounded ${formats.h2 ? 'bg-gray-200' : ''}`}
              >
                <Heading2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => exec('formatBlock', '<h3>')}
                title="H3"
                className={`p-1 rounded ${formats.h3 ? 'bg-gray-200' : ''}`}
              >
                <Heading3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => exec('formatBlock', '<blockquote>')}
                title="Citação"
                className={`p-1 rounded ${formats.quote ? 'bg-gray-200' : ''}`}
              >
                <Quote className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const url = prompt('URL')
                  if (url) exec('createLink', url)
                }}
                title="Link"
                className="p-1 rounded"
              >
                <Link className="h-4 w-4" />
              </button>
            </div>
            <div
              ref={editorRef}
              className="min-h-[200px] border p-2 rounded"
              contentEditable
            />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Softskills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-2">
                {softskills.map((s, idx) => (
                  <span
                    key={idx}
                    className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    {s}
                    <button onClick={() => removeItem(idx, 'soft')}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <button
                className="mt-2 px-3 py-1 border rounded flex items-center gap-1"
                onClick={() => setShowSidebar('soft')}
              >
                <Plus className="h-4 w-4" /> Adicionar critério
              </button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Fit cultural</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-2">
                {fits.map((s, idx) => (
                  <span
                    key={idx}
                    className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    {s}
                    <button onClick={() => removeItem(idx, 'fit')}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <button
                className="mt-2 px-3 py-1 border rounded flex items-center gap-1"
                onClick={() => setShowSidebar('fit')}
              >
                <Plus className="h-4 w-4" /> Adicionar critério
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
      {showSidebar && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
          <aside className="bg-white w-80 h-full p-4 overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Novo critério</h2>
              <button
                onClick={() => setShowSidebar(null)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Input
              placeholder="Nome"
              value={criterion}
              onChange={(e) => setCriterion(e.target.value)}
              className="mb-2"
            />
            <button
              onClick={addCriterion}
              className="px-4 py-2 bg-blue-600 text-white rounded w-full"
            >
              Salvar
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}

