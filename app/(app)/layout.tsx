import Nav from '@/components/nav'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main>{children}</main>
    </div>
  )
}
