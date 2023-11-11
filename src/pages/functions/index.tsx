import { AdminLayout } from '@layout'
import type { NextPage } from 'next'
import React from 'react'
import FunctionsViewer from '@components/functions/FunctionsViewer'

const Home: NextPage = () => (
  
  <AdminLayout>
      <FunctionsViewer />
  </AdminLayout>
)

export default Home
