// Start a express server

import { join } from "path"

import { DockerHost } from "@apiclient.xyz/docker"
import axios from "axios"
import express from "express"

const app = express()

const port = 3000

const webhookInstance = axios.create({ baseURL: "https://discord.com/api/webhooks/" })
const userInstance = axios.create({
  baseURL: "https://discord.com/api/channels/",
  headers: { Authorization: process.env.DISCORD_USER_TOKEN },
})

async function getChannelId(): Promise<string> {
  console.log("Getting channel id")
  const url = join(process.env.DISCORD_WEBHOOK_ID, process.env.DISCORD_WEBHOOK_TOKEN)
  const res = await webhookInstance.get<{ channel_id: string }>(url)
  return res.data.channel_id
}

type Message = {
  id: string;
  content: string;
}

async function getChannelMessages(channelId: string, after?: string): Promise<Message[]> {
  console.log("Getting messages from channel")
  const url = join(channelId, `messages?limit=100${after ? `&after=${after}` : ""}`)
  const res = await userInstance.get<Message[]>(url)
  return res.data.map((message) => message)
}

async function deleteMessage(channelId: string, messageId: string): Promise<void> {
  console.log("Deleting message")
  const url = join(channelId, `messages/${messageId}`)
  await userInstance.delete(url)
}

async function updateImage(input: string): Promise<void> {
  console.log(`Updating to ${input}`)
  // This command will retrieve the messages in the discord channel
  const channelId = await getChannelId()
  const messages = await getChannelMessages(channelId)
  // split the input as <image>:<version>
  const [image, version] = input.split(":")
  // We will find the messages that are about the docker image but not on this version
  const imageMessages = messages.filter((message) => message.content.includes(image) && !message.content.includes(version))

  // We will delete the old messages
  for (const message of imageMessages) {
    await deleteMessage(channelId, message.id)
  }
}

// Webhook called by Diun
app.post("/webhook", async (req, res) => {
  console.log("Received webhook for " + req.body.image)
  // Sample payload
  await updateImage(req.body.image)
  res.send("Updated")
})

// Manual update
app.get("/update/:input", async (req, res) => {
  console.log("Received Update")
  await updateImage(req.params.input)
  res.send("Updated")
})

async function cleanPrevious(): Promise<void> {
  const host = new DockerHost({})
  await host.start()

  const containers = await host.getContainers()
  const channelId = await getChannelId()
  const messages = await getChannelMessages(channelId)

  // If the current container image is in the discord channel, we will delete it
  for (const container of containers) {
    const image = container.Image
    const imageMessages = messages.filter((message) => message.content.includes(image))
    for (const message of imageMessages) {
      console.log(`Deleting ${message.content}`)
      await deleteMessage(channelId, message.id)
    }
  }
}

// We now want a quick cron that will regularly check ths local docker image and update the discord channels
app.get("/cron", async (req, res) => {
  console.log("Received Cron")
  await cleanPrevious()
  res.send("OK")
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
