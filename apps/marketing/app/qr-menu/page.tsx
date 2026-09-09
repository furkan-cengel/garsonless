import { marketingMetadata } from '../../lib/seo'
import { PRODUCT_PAGES } from '../../lib/product-pages'
import { ProductLandingPage } from '../../components/ProductLandingPage'

const product = PRODUCT_PAGES[0]!
export const metadata = marketingMetadata({ title: product.title, description: product.description, canonical: '/qr-menu' })

export default function Page() { return <ProductLandingPage product={product} /> }
