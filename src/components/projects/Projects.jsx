import React from 'react'
import './Projects.css'
import Fade from '../react-reveal/in-and-out/Fade'
import { featured_projects } from '../../data/featured_projects.js'
import { github_projects } from '../../data/github_projects.js'
import Project from '../project/Project'
import Section from '../section/Section'
import FeaturedProject from '../featuredProject/FeaturedProject'

const Projects = () => {
  return (
    <Section title="Projects">
      <div className="projects-content">
        <ul className="projects-list">
          {featured_projects.map((featuredProject) => (
            <li key={`featured-project-${featuredProject.id}`}>
              <Fade bottom duration={1000} distance="20px">
                <FeaturedProject
                  name={featuredProject.name}
                  link={featuredProject.link}
                  description={featuredProject.description}
                  colour={featuredProject.colour}
                  languages={featuredProject.languages}
                />
              </Fade>
            </li>
          ))}

          {github_projects.map((project) => (
            <li key={project.id}>
              <Fade bottom duration={1000} distance="20px">
                <Project project={project} type="github" />
              </Fade>
            </li>
          ))}
        </ul>

        <Fade bottom duration={1000} distance="20px">
          <div className="more-projects-wrapper">
            <a
              className="project-link"
              href="https://github.com/Patrick9263"
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="more-projects-button" type="button">
                more projects
              </button>
            </a>
          </div>
        </Fade>
      </div>
    </Section>
  )
}

export default Projects
