import { marketingMetadata } from '../../lib/seo'
import { PRODUCT_PAGES } from '../../lib/product-pages'
import { ProductLandingPage } from '../../components/ProductLandingPage'

const product = PRODUCT_PAGES[2]!
export const metadata = marketingMetadata({ title: product.title, description: product.description, canonical: '/qr-siparis' })

export default function Page() { return <ProductLandingPage product={product} /> }
