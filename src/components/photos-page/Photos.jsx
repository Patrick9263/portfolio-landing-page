import Section from '../section/Section'
import './PhotosPage.css'

const Photos = () => {
  return (
    <Section title="Photos">
      <div className="photos-preview">
        <a href="/?photos=true" className="open-gallery-button">
          Open gallery
        </a>
      </div>
    </Section>
  )
}

export default Photos
