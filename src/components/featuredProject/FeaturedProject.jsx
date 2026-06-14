import React from 'react'
import './FeaturedProject.css'

const logoImages = import.meta.glob('../../images/logos/*.{png,jpg,jpeg,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const getProjectLogo = (name) => {
  const logoName = name.replace(/ /g, '').toLowerCase()

  return (
    logoImages[`../../images/logos/${logoName}.png`] ||
    logoImages[`../../images/logos/${logoName}.jpg`] ||
    logoImages[`../../images/logos/${logoName}.jpeg`] ||
    logoImages[`../../images/logos/${logoName}.svg`]
  )
}

const FeaturedProject = ({ name, link, description, colour, languages }) => {
  const logoSrc = getProjectLogo(name)

  return (
    <a
      className="featured-project-link"
      href={link}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="featured-project-wrapper">
        <div className="featured-project">
          <div
            className="featured-project-bg"
            style={{
              background: colour,
            }}
          ></div>

          <div className="featured-project-top">
            {logoSrc ? (
              <img
                className="featured-project-image"
                src={logoSrc}
                alt={`${name}-logo`}
              />
            ) : null}
          </div>

          <p>{description}</p>

          <div className="project-info">
            <div className="project-info-left">
              {languages.map((language) => (
                <div key={`${name}-${language.name}`} className="language">
                  <div
                    className="language-colour"
                    style={{ backgroundColor: language.color }}
                  ></div>
                  <p className="language-name">{language.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </a>
  )
}

export default FeaturedProject
