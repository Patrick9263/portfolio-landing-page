import './Section.css'
import Fade from '../react-reveal/in-and-out/Fade'

const Section = ({ children, title }) => {
  const sectionId = title.toLowerCase()

  return (
    <section
      className={sectionId}
      id={sectionId}
      aria-labelledby={`${sectionId}-heading`}
    >
      <Fade left duration={1000} distance="70px">
        <h2 className="section-title" id={`${sectionId}-heading`}>
          {title}
        </h2>
      </Fade>
      <Fade right duration={1000}>
        <div className="underline"></div>
      </Fade>
      {children}
    </section>
  )
}

export default Section
