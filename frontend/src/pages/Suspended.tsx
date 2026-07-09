export default function Suspended() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="card max-w-sm text-center">
        <h1 className="text-lg font-bold text-red-500 mb-2">Access Suspended</h1>
        <p className="text-sm text-slate-500">
          This account is currently inactive. Please contact your administrator to restore access.
        </p>
      </div>
    </div>
  )
}
