import { permanentRedirect } from 'next/navigation'

export default function ResourcesRedirect() {
  permanentRedirect('/blog')
}
