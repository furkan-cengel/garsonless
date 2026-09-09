import { marketingMetadata } from '../../lib/seo'
import { PRODUCT_PAGES } from '../../lib/product-pages'
import { ProductLandingPage } from '../../components/ProductLandingPage'

const product = PRODUCT_PAGES[1]!
export const metadata = marketingMetadata({ title: product.title, description: product.description, canonical: '/dijital-adisyon' })

export default function Page() { return <ProductLandingPage product={product} /> }
