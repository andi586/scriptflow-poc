'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Edit3, Film } from 'lucide-react'

interface DirectorReviewPanelProps {
  prompts: Array<{ prompt: string; [key: string]: any }>
  onApprove: (editedPrompts: Array<{ prompt: string; [key: string]: any }>) => void
  onCancel: () => void
  isSubmitting: boolean
}

export function DirectorReviewPanel({
  prompts,
  onApprove,
  onCancel,
  isSubmitting
}: DirectorReviewPanelProps) {
  const [editedPrompts, setEditedPrompts] = useState<Array<{ prompt: string; [key: string]: any }>>([...prompts])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Sync editedPrompts when prompts prop changes (e.g. when parent sets data after mount)
  useEffect(() => {
    setEditedPrompts([...prompts])
  }, [prompts])

  const handleEdit = (index: number, value: string) => {
    const updated = [...editedPrompts]
    updated[index] = { ...updated[index], prompt: value }
    setEditedPrompts(updated)
  }

  return (
    <div className="space-y-6 rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-500/10 to-black/40 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Film className="h-6 w-6 text-purple-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Director Review</h2>
            <p className="text-sm text-zinc-400">
              Review and edit each shot prompt before submitting to Kling
            </p>
          </div>
        </div>
        <Badge className="bg-purple-900/50 text-purple-300 border border-purple-700">
          {editedPrompts.length} shots
        </Badge>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {editedPrompts.map((item, index) => (
          <Card key={index} className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-zinc-400 font-mono">
                  Shot {index + 1}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                  className="h-7 text-xs text-zinc-400 hover:text-purple-400"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  {editingIndex === index ? 'Done' : 'Edit'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {editingIndex === index ? (
                <Textarea
                  value={item.prompt}
                  onChange={(e) => handleEdit(index, e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 text-sm min-h-[80px] resize-none focus:border-purple-500"
                  autoFocus
                />
              ) : (
                <p className="text-sm text-zinc-300 leading-relaxed line-clamp-3">
                  {item.prompt}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="border-zinc-700 text-zinc-400 hover:text-white"
        >
          Cancel
        </Button>
        <Button
          onClick={() => onApprove(editedPrompts)}
          disabled={isSubmitting}
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {isSubmitting ? 'Submitting to Kling...' : `Approve & Submit ${editedPrompts.length} Shots`}
        </Button>
      </div>
    </div>
  )
}
