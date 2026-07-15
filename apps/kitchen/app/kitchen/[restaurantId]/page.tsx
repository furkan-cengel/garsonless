import { readKitchenBoard } from '@garsonless/application/tables'
import { createKitchenBoardPort, verifyKitchenActor } from '@garsonless/db/server'
import KitchenBoard from '../../../components/KitchenBoard'

interface Props {
  params: Promise<{ restaurantId: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function KitchenPage({ params, searchParams }: Props) {
  const { restaurantId } = await params
  const { token } = await searchParams

  if (!token) {
    return <ErrorScreen message="Erişim için token gerekli." detail="URL'ye ?token=... ekleyin." />
  }

  const valid = await verifyKitchenActor(restaurantId, token)
  if (!valid) {
    return <ErrorScreen message="Geçersiz token." detail="Dashboard'dan yeni bir token oluşturun." />
  }

  const board = await readKitchenBoard(
    { actor: 'kitchen', restaurantId, stationId: 'expo' },
    restaurantId,
    createKitchenBoardPort(),
  )
  if (!board.ok) return <ErrorScreen message="Mutfak verileri yüklenemedi." detail={board.error} />
  const { restaurant, orders, tableLabels, stations } = board.value

  if (!restaurant) {
    return <ErrorScreen message="Restoran bulunamadı." detail={`ID: ${restaurantId}`} />
  }

  return (
    <KitchenBoard
      restaurant={restaurant}
      initialOrders={orders}
      restaurantId={restaurantId}
      kitchenToken={token}
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
