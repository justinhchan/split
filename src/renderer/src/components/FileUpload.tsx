import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

export interface FileUploadProps {
  onFile: (text: string, filename: string) => void
  compact?: boolean
}

export function FileUpload({ onFile, compact }: FileUploadProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const openPicker = (): void => inputRef.current?.click()

  const handleFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return
    const file = files[0]
    const text = await file.text()
    onFile(text, file.name)
  }

  if (compact) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={openPicker}>
          <Upload />
          Load CSV
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </>
    )
  }

  return (
    <div
      onClick={openPicker}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        'card-surface flex min-h-60 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg p-8 text-center transition-colors',
        dragging && 'ring-2 ring-ring'
      )}
      role="button"
      tabIndex={0}
      aria-label="Upload CSV"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openPicker()
        }
      }}
    >
      <Upload className="h-6 w-6 text-muted-foreground" />
      <div>
        <h3 className="text-sm font-semibold text-balance">Drop a CSV here, or click to browse.</h3>
        <p className="mt-1 text-xs text-muted-foreground text-pretty">
          Most credit-card and bank exports work as-is. Columns are detected automatically.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
