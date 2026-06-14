import Section from '../section/Section'
import './PhotosPage.css'

const Photos = () => {
  return (
    <Section title="Photos">
      <div className="photos-preview">
        <a
          href="/?photos=true"
          rel="noopener noreferrer"
          className="open-gallery-anchor"
        >
          <button className="open-gallery-button" type="button">
            Open gallery
          </button>
        </a>
      </div>
    </Section>
  )
}

export default Photos
