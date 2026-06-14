import React from 'react'
import Section from '../section/Section'
import Button from '@material-ui/core/Button'
import { makeStyles } from '@material-ui/core/styles'
import './PhotosPage.css'

const useStyles = makeStyles((theme) => ({
  openGalleryAnchor: {
    textDecoration: 'none',
  },
  openGalleryButton: {
    '&': {
      margin: '20px auto',
      backgroundColor: '#1bdbdb',
      boxShadow: 'none',
      '&:hover': {
        backgroundColor: '#1bdbdb',
        boxShadow: 'none',
      },
    },
    '& > *': {
      padding: 4,
      fontSize: '15px',
      fontWeight: '600',
    },
  },
}))

const Photos = () => {
  const classes = useStyles()
  return (
    <Section title="Photos">
      <a
        href={'/?photos=true'}
        rel="noopener noreferrer"
        className={classes.openGalleryAnchor}
      >
        <Button
          className={classes.openGalleryButton}
          type="button"
          variant="contained"
        >
          Open gallery
        </Button>
      </a>
    </Section>
  )
}

export default Photos
