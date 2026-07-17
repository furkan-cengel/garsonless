import { readKitchenBoard } from '@garsonless/application/tables'
import { createKitchenBoardPort } from '@garsonless/db/server'
import { redirect } from 'next/navigation'
import KitchenBoard from '../../../components/KitchenBoard'
import { hasValidKitchenSession } from '../../../lib/kitchen-session'

interface Props {
  params: Promise<{ restaurantId: string }>
  searchParams: Promise<{ token?: string | string[] }>
}

export default async function KitchenPage({ params, searchParams }: Props) {
  const { restaurantId } = await params
  const query = await searchParams
  // Legacy bearer URLs must not even reach the rendered RSC payload: Next.js
  // serializes the current URL into its bootstrap data, which would otherwise
  // reflect a stale credential despite no longer accepting it for auth.
  if (query.token !== undefined) redirect(`/kitchen/${restaurantId}`)
  if (!await hasValidKitchenSession(restaurantId)) {
    return <ErrorScreen message="Mutfak oturumu gerekli." detail="Dashboard'dan Mutfak ekranını açın." />
  }

  const board = await readKitchenBoard(
    { actor: 'kitchen', restaurantId, stationId: 'expo' },
    restaurantId,
    createKitchenBoardPort(),
  )
  if (!board.ok) return <ErrorScreen message="Mutfak verileri yüklenemedi." detail={board.error} />
  const { restaurant, orderBatch, tableLabels, stations } = board.value

  if (!restaurant) {
    return <ErrorScreen message="Restoran bulunamadı." detail={`ID: ${restaurantId}`} />
  }

  return (
    <KitchenBoard
      restaurant={restaurant}
      initialOrderBatch={orderBatch}
      restaurantId={restaurantId}
      tableLabels={tableLabels}
      stations={stations}
    />
  )
}

function ErrorScreen({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-text">
      <div className="text-4xl">⚠️</div>
      <p className="text-lg font-semibold">{message}</p>
      <p className="text-sm text-text-muted">{detail}</p>
    </div>
  )
}
